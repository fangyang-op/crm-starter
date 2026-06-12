import { expect, test } from '@playwright/test'

import { storagePathFor } from '../integration/helpers/phase2-fixtures'
import {
  type Fixtures,
  hasSupabaseCreds,
  loadFixtureIds,
  service,
} from '../integration/helpers/supabase'
import { login } from './helpers'

test.skip(
  !hasSupabaseCreds,
  'E2E requires Supabase test credentials + E2E_TEST_PASSWORD (set in .env.test / CI secrets).',
)

// Flow F — 文件下載 via signed URL. Seeds a required-document object + row on feA
// so the 下載 button renders, then asserts the click opens the (private-bucket)
// signed URL. The TTL=60s + RLS fail-closed properties are asserted at the
// integration layer (phase2-flows); this proves the UI download wiring.
const BUCKET = 'student-required-documents'
const TINY_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

let fx: Fixtures
let srdRowId: string | null = null
let objPath: string

test.beforeAll(async () => {
  fx = await loadFixtureIds()
  const sb = service()
  objPath = storagePathFor(fx.studentIds.feA)
  const up = await sb.storage.from(BUCKET).upload(objPath, TINY_PDF, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (up.error) throw new Error('[flow-download] upload: ' + up.error.message)

  const { data: tpl } = await sb.from('document_templates').select('id').limit(1).single()
  const { data: row, error } = await sb
    .from('student_required_documents')
    .upsert(
      {
        student_id: fx.studentIds.feA,
        document_template_id: (tpl as { id: string }).id,
        is_required: true,
        status: 'uploaded',
        file_path: objPath,
      },
      { onConflict: 'student_id,document_template_id' },
    )
    .select('id')
    .single()
  if (error) throw new Error('[flow-download] seed srd: ' + error.message)
  srdRowId = (row as { id: string }).id
})

test.afterAll(async () => {
  const sb = service()
  if (srdRowId) await sb.from('student_required_documents').delete().eq('id', srdRowId)
  await sb.storage.from(BUCKET).remove([objPath])
})

test.describe('Flow F — 文件下載 (signed URL)', () => {
  test('owning consultant 點下載 → 開啟 private bucket 的 signed URL', async ({
    page,
    context,
  }) => {
    await login(page, 'fe_consultant') // owns feA
    await page.goto(`/students/${fx.studentIds.feA}`)
    await page.getByRole('button').filter({ hasText: '申請準備檔案' }).click()
    const sheet = page.getByRole('dialog')
    const downloadBtn = sheet.getByRole('button', { name: '下載' }).first()
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 })

    // The handler does window.open(signedUrl) → a popup. In headless Chromium the
    // inline-PDF popup becomes a download, so reading popup.url() is unreliable;
    // intercept the storage request at the context level (covers popups) and
    // capture the actual signed URL it navigates to.
    let signedReqUrl = ''
    await context.route('**/storage/v1/object/sign/**', async (route) => {
      signedReqUrl = route.request().url()
      await route.abort()
    })
    await downloadBtn.click()
    await expect
      .poll(() => signedReqUrl, { timeout: 10_000 })
      .toContain(`/storage/v1/object/sign/${BUCKET}/`)
    expect(signedReqUrl).toContain('token=') // a real signed URL, not a public link
  })
})
