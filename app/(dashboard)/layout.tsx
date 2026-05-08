import { redirect } from 'next/navigation'

import { Sidebar, type SidebarBadges } from '@/components/layouts/sidebar'
import { Topbar } from '@/components/layouts/topbar'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/constants/roles'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // perf: profile 與 UAT badge 三次查詢並行,layout 整體等待時間從原本
  // 「auth → profile → badge」串列變成「auth → (profile ‖ badge)」。
  // UAT 三個查詢只看 user.id,不需要 role,filter 在資料抓回來再做。
  const [profileResult, chaptersResult, itemsResult, filledCountResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, full_name, display_name, email, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('uat_chapters' as never)
      .select('id, target_roles')
      .eq('is_active' as never, true as never),
    supabase
      .from('uat_items' as never)
      .select('id, chapter_id')
      .eq('is_active' as never, true as never),
    supabase
      .from('uat_results' as never)
      .select('id', { count: 'exact', head: true })
      .eq('user_id' as never, user.id as never),
  ])

  const { data: profile, error } = profileResult
  if (error || !profile) {
    // No profile row for this auth user — bootstrap is incomplete. Force re-login.
    redirect('/login')
  }

  // uat-portal §6: 算這位使用者尚未填寫的 UAT 項目數;UAT 表查不到時走
  // catch / fallback 0,不能讓 dashboard layout 因為 migration 未跑就壞掉。
  const badges: SidebarBadges = { uat_pending: 0 }
  try {
    const role = profile.role as UserRole
    const chapters = (
      (chaptersResult.data ?? []) as unknown as Array<{
        id: string
        target_roles: string[] | null
      }>
    ).filter((c) => !c.target_roles || c.target_roles.length === 0 || c.target_roles.includes(role))
    const items = (itemsResult.data ?? []) as unknown as Array<{ id: string; chapter_id: string }>
    const visibleChapterIds = new Set(chapters.map((c) => c.id))
    const visibleItemTotal = items.filter((i) => visibleChapterIds.has(i.chapter_id)).length
    badges.uat_pending = Math.max(0, visibleItemTotal - (filledCountResult.count ?? 0))
  } catch {
    // ditto fallback
  }

  return (
    // h-screen + overflow-hidden 把整個 layout 鎖在 viewport 高度內,
    // 讓 Sidebar 與右側內容區獨立捲動 — 否則 min-h-screen 會讓內容超
    // 過視窗時整頁滾動(Sidebar 跟著走)。
    <div className="flex h-screen overflow-hidden bg-[#F9FAFC]">
      <Sidebar role={profile.role} badges={badges} />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
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
