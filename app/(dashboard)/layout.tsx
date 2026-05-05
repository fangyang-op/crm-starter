import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layouts/sidebar'
import { Topbar } from '@/components/layouts/topbar'
import type { UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name, display_name, email, avatar_url')
    .eq('id', user.id)
    .single<{
      role: UserRole
      full_name: string
      display_name: string | null
      email: string
      avatar_url: string | null
    }>()

  if (error || !profile) {
    // No profile row for this auth user — bootstrap is incomplete. Force re-login.
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          fullName={profile.full_name}
          displayName={profile.display_name}
          email={profile.email}
          role={profile.role}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30">{children}</main>
      </div>
    </div>
  )
}
