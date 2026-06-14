import { redirect } from 'next/navigation'

import { Sidebar, type SidebarBadges } from '@/components/layouts/sidebar'
import { Topbar } from '@/components/layouts/topbar'
import { getCurrentProfile, getCurrentUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/constants/roles'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // React.cache-memoized: the leaf page + child Server Components reuse this same
  // getUser()/profile result within the render, so auth runs once per nav. (Tier 1)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  if (!profile) {
    // No profile row for this auth user — bootstrap is incomplete. Force re-login.
    redirect('/login')
  }

  // uat-portal §6: 計算此 user 尚未填寫的 UAT 項目數,做為 sidebar badge。
  // 步驟:抓所有 active 章節 (依 target_roles 過濾) → 算可見 active items
  // 總數 → 減掉該 user 已填的 result 數。失敗時 silently → 0,不能讓
  // dashboard layout 因 UAT 表查不到就壞掉(例如 migration 未跑)。
  const badges: SidebarBadges = { uat_pending: 0 }
  try {
    const role: UserRole = profile.role
    const supabase = await createClient()
    const [{ data: chaptersRaw }, { data: itemsRaw }, { count: filledCount }] = await Promise.all([
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
    const chapters = (chaptersRaw ?? []) as unknown as Array<{
      id: string
      target_roles: string[] | null
    }>
    const items = (itemsRaw ?? []) as unknown as Array<{ id: string; chapter_id: string }>
    const visibleChapterIds = new Set(
      chapters
        .filter(
          (c) => !c.target_roles || c.target_roles.length === 0 || c.target_roles.includes(role),
        )
        .map((c) => c.id),
    )
    const visibleItemTotal = items.filter((i) => visibleChapterIds.has(i.chapter_id)).length
    badges.uat_pending = Math.max(0, visibleItemTotal - (filledCount ?? 0))
  } catch {
    // UAT 表還沒部署就走這條 — badge 設 0 即可,sidebar 自動隱藏。
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
