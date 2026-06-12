import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'

import { type Fixtures, hasSupabaseCreds, loadFixtureIds } from '../integration/helpers/supabase'
import { login } from './helpers'

test.skip(
  !hasSupabaseCreds,
  'E2E requires Supabase test credentials + E2E_TEST_PASSWORD (set in .env.test / CI secrets).',
)

// Flow E — 文件上傳內容嗅探 (Stage 2-B). A renamed fake file is rejected server-side
// by magic-byte sniffing BEFORE any Storage write — so the rejection path leaves
// no object and needs no cleanup.
let fx: Fixtures
let fakePdfPath: string

test.beforeAll(async () => {
  fx = await loadFixtureIds()
  const dir = mkdtempSync(join(tmpdir(), 't3-upload-'))
  fakePdfPath = join(dir, 'evil.pdf')
  // A Windows executable (MZ magic) renamed .pdf. The client declares it
  // application/pdf, but content sniffing detects it is not a PDF → reject.
  writeFileSync(fakePdfPath, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(256)]))
})

test.describe('Flow E — 文件上傳內容嗅探', () => {
  test('改名假檔(EXE → .pdf)被內容嗅探擋下,不寫入 Storage', async ({ page }) => {
    await login(page, 'fe_consultant') // owns feA → canEdit
    await page.goto(`/students/${fx.studentIds.feA}`)

    // Open the 申請準備檔案 panel (the card itself is a role=button trigger).
    await page.getByRole('button').filter({ hasText: '申請準備檔案' }).click()
    const sheet = page.getByRole('dialog')
    const fileInput = sheet.locator('input[type=file]').first()
    await expect(fileInput).toBeAttached({ timeout: 10_000 })

    // setInputFiles drives the hidden (sr-only) input directly — no OS dialog.
    await fileInput.setInputFiles(fakePdfPath)

    // The server action's sniffUploadedFile rejects it; the row never flips to
    // 已上傳 and no 下載 affordance appears.
    await expect(page.getByText('檔案格式無法辨識或不被接受')).toBeVisible({ timeout: 15_000 })
  })
})
