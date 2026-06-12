import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

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

// Flow H — UAT CSV 匯出 (admin-only) + CSV-injection 中和 (Stage 2-B). Seed an
// admin-owned result whose 備註 is a formula payload; the export must neutralize
// it (leading single-quote) so Excel/Sheets never auto-execute it.
const INJECTION_NOTE = "=cmd|' /C calc'!A1"

let fx: Fixtures
let seededRowId: string | null = null

test.beforeAll(async () => {
  fx = await loadFixtureIds()
  const sb = service()
  // Pick a uat_item the admin has no result for (UNIQUE(item_id,user_id)).
  const { data: usedRows } = await sb
    .from('uat_results')
    .select('item_id')
    .eq('user_id', fx.userIds.admin)
  const used = new Set((usedRows ?? []).map((r) => (r as { item_id: string }).item_id))
  const { data: items } = await sb.from('uat_items').select('id')
  const freeItem = (items ?? []).find((i) => !used.has((i as { id: string }).id))
  if (!freeItem) throw new Error('[flow-csv-export] no free uat_item for admin')
  const { data: row, error } = await sb
    .from('uat_results')
    .insert({
      item_id: (freeItem as { id: string }).id,
      user_id: fx.userIds.admin,
      result: 'fail',
      note: INJECTION_NOTE,
    })
    .select('id')
    .single()
  if (error) throw new Error('[flow-csv-export] seed uat_results: ' + error.message)
  seededRowId = (row as { id: string }).id
})

test.afterAll(async () => {
  if (seededRowId) await service().from('uat_results').delete().eq('id', seededRowId)
})

test.describe('Flow H — UAT CSV 匯出 + 公式中和', () => {
  test('admin 匯出 CSV;含 BOM/CRLF/表頭,且公式型 備註 被中和', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/uat/admin')
    const exportBtn = page.getByRole('button', { name: /匯出\s*CSV/ })
    await expect(exportBtn).toBeVisible({ timeout: 10_000 }) // admin reached the page

    // Attach the download listener BEFORE clicking (avoids a race).
    const [download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()])
    expect(download.suggestedFilename()).toMatch(/^uat-results-\d{4}-\d{2}-\d{2}\.csv$/)

    const path = await download.path()
    const text = readFileSync(path, 'utf8')

    // Well-formed export.
    expect(text.charCodeAt(0)).toBe(0xfeff) // UTF-8 BOM (Excel)
    expect(text).toContain('\r\n') // CRLF
    expect(text).toContain('備註') // header column

    // The load-bearing security assertion: the formula note is neutralized.
    expect(text).toContain("'=cmd") // leading single-quote prepended
    expect(text).not.toContain(',=cmd') // never a raw formula at a cell boundary
  })
})
