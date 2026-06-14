import { existsSync } from 'node:fs'

import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Dedicated config for the perf measurement harness (tests/perf), kept OUT of
// the CI test run (playwright.config.ts globs tests/e2e only). Reuses the same
// app server + fixture seeding. Run: `npm run perf:nav`.
for (const f of ['.env.test', '.env.local']) {
  if (existsSync(f)) loadEnv({ path: f })
}

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/perf',
  testMatch: '**/*.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  reporter: 'list',
  use: { baseURL, trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: 'http://localhost:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
