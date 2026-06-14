import 'server-only'

import { cache } from 'react'

import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/constants/roles'

// Per-request memoized auth. React.cache dedups across the dashboard layout, the
// page, and any child Server Component in the SAME render pass, so the auth
// validation round-trip (supabase.auth.getUser() hits Supabase Auth over the
// network, it is NOT a local cookie decode) and the profiles role lookup each
// run ONCE per navigation instead of 2–3×. (Perf Tier 1.)
//
// Note: Edge middleware runs in a separate invocation and cannot share this
// cache — its own getUser() stays as the security gate. This only collapses the
// duplicates within the React render tree.

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export type CurrentProfile = {
  id: string
  role: UserRole
  full_name: string
  display_name: string | null
  email: string
}

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role, full_name, display_name, email')
    .eq('id', user.id)
    .single()
  if (!data) return null
  return {
    id: user.id,
    role: data.role as UserRole,
    full_name: data.full_name,
    display_name: data.display_name,
    email: data.email,
  }
})
