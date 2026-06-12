import { teardownPhase2 } from '../integration/helpers/phase2-fixtures'
import { hasSupabaseCreds, loadFixtureIds, teardownFixtures } from '../integration/helpers/supabase'

export default async function globalTeardown() {
  if (!hasSupabaseCreds) return
  // Defensive Phase-2 cleanup: even if a spec's afterAll didn't run (e.g. it
  // failed mid-way), remove any deals/applications/schools/storage it left so
  // teardownFixtures()'s student delete won't FK-fail (deals/schools have no
  // ON DELETE CASCADE from students). teardownPhase2 keys off the fixture
  // student ids, so resolve them first; it is idempotent / no-op when clean.
  try {
    const fx = await loadFixtureIds()
    if (Object.keys(fx.studentIds).length) await teardownPhase2(fx)
  } catch {
    // best-effort — never block the user/account teardown below
  }
  await teardownFixtures()
}
