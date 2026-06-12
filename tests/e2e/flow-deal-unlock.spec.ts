import { expect, test } from '@playwright/test'

import { type Fixtures, hasSupabaseCreds, loadFixtureIds } from '../integration/helpers/supabase'
import { login } from './helpers'

test.skip(
  !hasSupabaseCreds,
  'E2E requires Supabase test credentials + E2E_TEST_PASSWORD (set in .env.test / CI secrets).',
)

// Flow D — 成交 → 解鎖. The 選校表 / 文件 / 申請 tabs are locked until the student
// has ≥1 deal. feA (測試學生_T3_前端A) starts deal-free; the deal created here is
// cleaned by globalTeardown's defensive teardownPhase2.
let fx: Fixtures

test.beforeAll(async () => {
  fx = await loadFixtureIds()
})

test.describe('Flow D — 成交 → 解鎖', () => {
  test('建立成交後,選校表 / 文件 / 申請分頁由鎖定變為可用', async ({ page }) => {
    await login(page, 'fe_consultant') // owns feA
    await page.goto(`/students/${fx.studentIds.feA}`)

    // Locked before any deal exists.
    await expect(page.getByRole('tab', { name: '選校表 🔒' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '選校表 🔒' })).toBeDisabled()
    await expect(page.getByRole('tab', { name: '文件 🔒' })).toBeDisabled()
    await expect(page.getByRole('tab', { name: '申請 🔒' })).toBeDisabled()

    // Create a deal through the real UI.
    await page.getByRole('tab', { name: '成交', exact: true }).click()
    await page.getByRole('button', { name: '建立成交' }).click() // opens the sheet
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').filter({ hasText: '選擇方案' }).click()
    await page.getByRole('option').filter({ hasText: 'US-MASTER-10' }).first().click()
    // signed_at is pre-filled (today), 主要顧問 pre-selected (the student's FE
    // consultant), split defaults to 100% → submit directly.
    await dialog.getByRole('button', { name: '建立成交' }).click()

    await expect(page.getByText('成交建立成功')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0) // sheet closed

    // After router.refresh the gate flips: 🔒 tabs are gone and the real tabs
    // are enabled.
    await expect(page.getByRole('tab', { name: '選校表 🔒' })).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByRole('tab', { name: '選校表', exact: true })).toBeEnabled()
    await expect(page.getByRole('tab', { name: '文件', exact: true })).toBeEnabled()
    await expect(page.getByRole('tab', { name: '申請', exact: true })).toBeEnabled()
  })
})
