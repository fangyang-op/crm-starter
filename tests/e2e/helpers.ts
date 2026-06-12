import { type Page } from '@playwright/test'

import { emailFor, type Role, TEST_USER_PASSWORD } from '../integration/helpers/supabase'

/** Log in through the real form as a seeded role. Clears cookies first, else
 *  middleware redirects /login → / when a previous role's session is still set
 *  (a test logging in as a second role within the same context). Mirrors the
 *  helper in route-protection.spec.ts. */
export async function login(page: Page, role: Role): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.fill('#email', emailFor(role))
  await page.fill('#password', TEST_USER_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 15_000 })
}
