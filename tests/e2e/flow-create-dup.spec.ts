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

// Flow C — 建檔 + 重複偵測 (附錄 C.4 #i + Stage 2-A 最小揭露). Uses the fixture
// student feA's phone to trigger the duplicate path. feA = 測試學生_T3_前端A,
// owned by fe_consultant.
const OVERRIDE_NAME = '測試學生_T3_DUP覆寫'

let fx: Fixtures
let dupPhone: string

test.beforeAll(async () => {
  fx = await loadFixtureIds()
  dupPhone = fx.studentPhones.feA // '0900100001'
})

test.afterAll(async () => {
  // Clean up any student the override test created (teardownFixtures only removes
  // the 4 fixed fixture names, so this extra student would otherwise leak).
  const sb = service()
  const { data } = await sb.from('students').select('id').eq('full_name', OVERRIDE_NAME)
  for (const s of (data ?? []) as { id: string }[]) {
    await sb.from('activity_log').delete().eq('student_id', s.id)
    await sb.from('students').delete().eq('id', s.id)
  }
})

test.describe('Flow C — 建檔 + 重複偵測', () => {
  test('consultant: duplicate phone → minimal-disclosure notice, NO override affordance, NO PII leak', async ({
    page,
  }) => {
    await login(page, 'fe_consultant')
    await page.goto('/students/new')
    await page.getByLabel('電話').fill(dupPhone)
    await page.getByLabel('電話').blur()

    // The generic, role-aware minimal-disclosure message (no name/advisor/id).
    await expect(page.getByText('此聯繫方式已存在,請聯繫管理員或主管')).toBeVisible({
      timeout: 10_000,
    })

    // 任務三(i): a consultant cannot self-override — no acknowledge/continue button.
    await expect(page.getByRole('button', { name: '確認為不同學生,繼續建立' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '仍要繼續建立' })).toHaveCount(0)
    // The existing student's identity must NOT leak to the consultant.
    await expect(page.getByText('測試學生_T3_前端A')).toHaveCount(0)
    await expect(page.getByText('系統找到一筆相同手機號碼的學生')).toHaveCount(0)
  })

  test('manager: duplicate phone → full disclosure (existing name + override button)', async ({
    page,
  }) => {
    await login(page, 'fe_manager')
    await page.goto('/students/new')
    await page.getByLabel('電話').fill(dupPhone)
    await page.getByLabel('電話').blur()

    await expect(page.getByText('系統找到一筆相同手機號碼的學生')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('測試學生_T3_前端A')).toBeVisible() // manager sees the match
    await expect(page.getByRole('button', { name: '確認為不同學生,繼續建立' })).toBeVisible()
  })

  test('manager override → creates student + logs duplicate_phone_override + appears on /duplicate-overrides', async ({
    page,
  }) => {
    await login(page, 'fe_manager')
    await page.goto('/students/new')
    await page.getByLabel('中文姓名').fill(OVERRIDE_NAME)
    await page.getByLabel('電話').fill(dupPhone)
    await page.getByLabel('電話').blur()

    await expect(page.getByText('系統找到一筆相同手機號碼的學生')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: '確認為不同學生,繼續建立' }).click()
    await expect(page.getByText('✓ 已確認為不同學生,送出後會記錄供主管審核')).toBeVisible()

    // 名單來源 (required) is pre-filled with the 'self_developed' fallback, and
    // 中文姓名 is set — enough to submit the override create.
    await page.getByRole('button', { name: '建立學生' }).click()
    await page.waitForURL(/\/students\/[0-9a-f-]+$/, { timeout: 15_000 })

    // DB audit: the override was logged (server-side, by createStudent).
    const sb = service()
    const { data: created } = await sb
      .from('students')
      .select('id')
      .eq('full_name', OVERRIDE_NAME)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    const newId = (created as { id: string }).id
    const { data: log } = await sb
      .from('activity_log')
      .select('action, payload')
      .eq('student_id', newId)
      .eq('action', 'duplicate_phone_override')
    expect((log ?? []).length).toBe(1)

    // It surfaces on the manager/admin-only override review page.
    await page.goto('/duplicate-overrides')
    await expect(page.getByText(/建立了與現有名單同號的新學生/).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(OVERRIDE_NAME).first()).toBeVisible()
  })
})
