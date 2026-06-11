import { existsSync } from 'node:fs'

import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Playwright loads this config as CJS — avoid import.meta (ESM-only). Env is
// resolved relative to the project root (the cwd when running `playwright test`)
// so globalSetup/teardown + the app server see the credentials.
for (const f of ['.env.test', '.env.local']) {
  if (existsSync(f)) loadEnv({ path: f })
}

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  // Role logins share the same seeded DB fixtures → keep it serial.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the app locally; against an external E2E_BASE_URL (e.g. a Vercel
  // preview) we skip the local server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
