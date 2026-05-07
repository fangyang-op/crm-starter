import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layouts/sidebar'
import { Topbar } from '@/components/layouts/topbar'
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
    .single()

  if (error || !profile) {
    // No profile row for this auth user — bootstrap is incomplete. Force re-login.
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFC]">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          fullName={profile.full_name}
          displayName={profile.display_name}
          email={profile.email}
          role={profile.role}
        />
        {/* v1.2 §1: main bg is #F9FAFC — slightly off-white so the sidebar's
            white surface + right-edge shadow reads as a discrete panel. */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
