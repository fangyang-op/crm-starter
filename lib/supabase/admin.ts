import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

// Service-role client. NEVER import this from a "use client" file or even
// from any module that ends up in the client bundle — `'server-only'` will
// blow up the build if you do.
//
// We only use this for narrow auth.admin operations (create user, update
// password, etc.). Everything else stays on the anon-keyed RLS-gated
// `lib/supabase/server.ts` client.
//
// Action layers MUST do their own permission check (e.g. caller is admin)
// BEFORE invoking anything on this client — service role bypasses RLS
// entirely.

let cached: SupabaseClient<Database> | null = null

export function createAdminClient(): SupabaseClient<Database> {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing. Set it in .env.local (server-only secret).')
  }

  cached = createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
