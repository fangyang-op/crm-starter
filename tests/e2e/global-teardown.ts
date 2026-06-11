import { hasSupabaseCreds, teardownFixtures } from '../integration/helpers/supabase'

export default async function globalTeardown() {
  if (hasSupabaseCreds) await teardownFixtures()
}
