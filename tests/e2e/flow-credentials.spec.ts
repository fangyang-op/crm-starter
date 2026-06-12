import { expect, test } from '@playwright/test'

import {
  seedPhase2,
  teardownPhase2,
  type Phase2Fixtures,
} from '../integration/helpers/phase2-fixtures'
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

// Flow G — 申請 / Portal 帳密 UI. Set a portal password through the real UI and
// reveal it. The AES at-rest + RLS read/write-deny security core is covered by
// the integration suite; this proves the set/reveal UI wiring. Uses `shared`
// (owned by fe_consultant + be_consultant); a deal is seeded so the 申請 tab
// unlocks, plus the 【T3】 application from seedPhase2.
const PW = 'P0rtal!學生pw'
let fx: Fixtures
let p2: Phase2Fixtures

test.beforeAll(async () => {
  fx = await loadFixtureIds()
  const sb = service()
  p2 = await seedPhase2(fx) // 【T3】 school + application on `shared` (+ feB + storage)
  // Seed a deal on `shared` so the 申請 tab is enabled.
  const { data: plan } = await sb
    .from('service_plans')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  const { error } = await sb.from('deals').insert({
    student_id: fx.studentIds.shared,
    plan_id: (plan as { id: string }).id,
    base_amount: 0,
    final_amount: 0,
    signed_at: '2026-06-12',
  })
  if (error) throw new Error('[flow-credentials] seed deal: ' + error.message)
})

test.afterAll(async () => {
  await teardownPhase2(fx) // removes the deal / application / school / storage
})

test.describe('Flow G — 申請 / Portal 帳密', () => {
  test('承辦顧問可設定 Portal 密碼,並還原顯示為輸入值', async ({ page }) => {
    void p2 // application seeded by seedPhase2 is what the card below opens
    await login(page, 'be_consultant') // backend consultant of `shared` → canEdit
    await page.goto(`/students/${fx.studentIds.shared}`)
    await page.getByRole('tab', { name: '申請', exact: true }).click()

    // Open the seeded application's detail sheet (board card shows school name).
    await page.getByRole('button').filter({ hasText: '【T3】Test University' }).first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText('Portal 帳密')).toBeVisible({ timeout: 10_000 })

    // Set a new portal password.
    await sheet.getByRole('button', { name: '設定密碼' }).click()
    await sheet.getByPlaceholder('輸入新密碼').fill(PW)
    await sheet.getByRole('button', { name: '儲存 Portal' }).click()
    await expect(page.getByText('已更新 Portal 資訊')).toBeVisible({ timeout: 15_000 })
    await expect(sheet.getByText('已設定')).toBeVisible()

    // Reveal → the masked field decrypts back to the exact plaintext entered.
    await sheet.getByRole('button', { name: '顯示' }).click()
    await expect(sheet.locator('input.font-mono[readonly]')).toHaveValue(PW, { timeout: 10_000 })
  })
})
