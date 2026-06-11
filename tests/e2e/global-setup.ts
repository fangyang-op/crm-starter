import { hasSupabaseCreds, seedFixtures } from '../integration/helpers/supabase'

// Seeds the t3test_ accounts + 測試學生_T3 fixtures (service_role, for setup
// only). Runs once before the E2E suite. Requires E2E_TEST_PASSWORD so the
// seeded password is shared with the test workers that log in.
export default async function globalSetup() {
  if (!hasSupabaseCreds) {
    console.warn(
      '[e2e] No Supabase credentials — seeding skipped; login tests will self-skip. ' +
        'Set TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY + E2E_TEST_PASSWORD.',
    )
    return
  }
  if (!process.env.E2E_TEST_PASSWORD) {
    throw new Error(
      '[e2e] E2E_TEST_PASSWORD must be set (shared between seed + login workers). Add it to .env.test / CI secrets.',
    )
  }
  await seedFixtures()
}
