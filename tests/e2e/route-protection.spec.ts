import { expect, type Page, test } from '@playwright/test'

import {
  emailFor,
  hasSupabaseCreds,
  type Role,
  TEST_USER_PASSWORD,
} from '../integration/helpers/supabase'

test.skip(
  !hasSupabaseCreds,
  'E2E requires Supabase test credentials + E2E_TEST_PASSWORD (set in .env.test / CI secrets).',
)

async function login(page: Page, role: Role) {
  // Clear any existing session first, otherwise middleware redirects /login → /
  // (when a test logs in as a second role within the same context).
  await page.context().clearCookies()
  await page.goto('/login')
  await page.fill('#email', emailFor(role))
  await page.fill('#password', TEST_USER_PASSWORD)
  await page.click('button[type=submit]')
  // login form animates success then router.push('/')
  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 15_000 })
}

async function landingPath(page: Page, route: string): Promise<string> {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  return new URL(page.url()).pathname
}

test.describe('Route protection — 附錄 C.4 #4/#5/#6 + 任務四 H', () => {
  test('consultant is redirected away from admin/manager routes', async ({ page }) => {
    await login(page, 'fe_consultant')
    expect(await landingPath(page, '/settings')).toBe('/') // C.4 #4
    expect(await landingPath(page, '/uat/admin')).toBe('/') // C.4 #5
    expect(await landingPath(page, '/duplicate-overrides')).toBe('/') // C.4 #6
    expect(await landingPath(page, '/students')).toBe('/students') // allowed
  })

  test('manager: /settings + /uat/admin blocked (admin-only); /duplicate-overrides allowed', async ({
    page,
  }) => {
    await login(page, 'fe_manager')
    // /settings is admin-only (settings/layout.tsx gates on isAdmin) — this branch
    // is based on main which already includes that fix, so managers are redirected.
    expect(await landingPath(page, '/settings')).toBe('/')
    expect(await landingPath(page, '/uat/admin')).toBe('/')
    expect(await landingPath(page, '/duplicate-overrides')).toBe('/duplicate-overrides')
  })

  test('admin: all admin routes accessible', async ({ page }) => {
    await login(page, 'admin')
    expect(await landingPath(page, '/settings')).toBe('/settings')
    expect(await landingPath(page, '/uat/admin')).toBe('/uat/admin')
    expect(await landingPath(page, '/duplicate-overrides')).toBe('/duplicate-overrides')
  })

  test('sidebar 設定 entry only renders for admin', async ({ page }) => {
    await login(page, 'fe_consultant')
    await page.goto('/')
    await expect(page.locator('nav a[href="/settings"]')).toHaveCount(0)

    await login(page, 'admin')
    await page.goto('/')
    await expect(page.locator('nav a[href="/settings"]')).toHaveCount(1)
  })
})
