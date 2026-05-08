import { redirect } from 'next/navigation'

import { BarChart } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, type UserRole } from '@/lib/constants/roles'

import { AdminClient, type AdminPersonRow, type AdminFailRow } from './admin-client'

export const metadata = { title: 'UAT 總覽 — 放洋全端 CRM 平台' }

type ItemRow = { id: string; chapter_id: string; item_code: string; step_description: string }
type ChapterRow = { id: string; title_zh: string; target_roles: string[] | null }
type ResultRow = {
  user_id: string
  item_id: string
  result: 'pass' | 'fail'
  note: string | null
  screenshot_path: string | null
}
type ProfileRow = {
  id: string
  full_name: string
  display_name: string | null
  role: UserRole
  is_active: boolean
}

export default async function UatAdminPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const myRole = (me as { role: UserRole } | null)?.role
  if (myRole !== 'admin') redirect('/')

  const [{ data: chaptersRaw }, { data: itemsRaw }, { data: resultsRaw }, { data: profilesRaw }] =
    await Promise.all([
      supabase
        .from('uat_chapters' as never)
        .select('id, title_zh, target_roles')
        .eq('is_active' as never, true as never),
      supabase
        .from('uat_items' as never)
        .select('id, chapter_id, item_code, step_description')
        .eq('is_active' as never, true as never),
      supabase
        .from('uat_results' as never)
        .select('user_id, item_id, result, note, screenshot_path'),
      supabase.from('profiles').select('id, full_name, display_name, role, is_active'),
    ])

  const chapters = (chaptersRaw ?? []) as unknown as ChapterRow[]
  const items = (itemsRaw ?? []) as unknown as ItemRow[]
  const results = (resultsRaw ?? []) as unknown as ResultRow[]
  const profiles = (profilesRaw ?? []) as unknown as ProfileRow[]

  // 對每個 user 計算可見項目總數(根據章節 target_roles 過濾),這樣
  // admin/manager 看到的「總項目數」會對應該角色實際能填的項目。
  const itemsByChapter = new Map<string, ItemRow[]>()
  for (const it of items) {
    const list = itemsByChapter.get(it.chapter_id) ?? []
    list.push(it)
    itemsByChapter.set(it.chapter_id, list)
  }

  const visibleItemsForRole = (role: UserRole): ItemRow[] => {
    const list: ItemRow[] = []
    for (const c of chapters) {
      const visible =
        !c.target_roles || c.target_roles.length === 0 || c.target_roles.includes(role)
      if (!visible) continue
      list.push(...(itemsByChapter.get(c.id) ?? []))
    }
    return list
  }

  // ────────────────────────────────────────────────────────────────────────
  // 統計卡片
  // ────────────────────────────────────────────────────────────────────────
  // 「測試人員」= 有任何結果記錄的 distinct user 數。
  const testers = new Set(results.map((r) => r.user_id))
  const totalPass = results.filter((r) => r.result === 'pass').length
  const totalFail = results.filter((r) => r.result === 'fail').length

  // 章節完成率 = (該章節所有可見人員 × 該章節 items 已填總數) / 應填總數。
  // 簡化算:對於每個 active profile,計算可見章節數;每個章節若該人 100% 填完
  // 即 +1 to 「完成」,/ 總章節人次。
  let chapterCompletedPersonChapter = 0
  let chapterTotalPersonChapter = 0
  for (const p of profiles.filter((p) => p.is_active)) {
    for (const c of chapters) {
      const visible =
        !c.target_roles || c.target_roles.length === 0 || c.target_roles.includes(p.role)
      if (!visible) continue
      chapterTotalPersonChapter += 1
      const chapterItems = itemsByChapter.get(c.id) ?? []
      if (chapterItems.length === 0) continue
      const filled = chapterItems.filter((it) =>
        results.some((r) => r.user_id === p.id && r.item_id === it.id),
      ).length
      if (filled === chapterItems.length) chapterCompletedPersonChapter += 1
    }
  }
  const chapterCompletionRate =
    chapterTotalPersonChapter === 0
      ? 0
      : Math.round((chapterCompletedPersonChapter / chapterTotalPersonChapter) * 100)

  // ────────────────────────────────────────────────────────────────────────
  // 人員進度總表
  // ────────────────────────────────────────────────────────────────────────
  const personRows: AdminPersonRow[] = profiles
    .filter((p) => p.is_active)
    .map((p) => {
      const visibleItems = visibleItemsForRole(p.role)
      const myResults = results.filter((r) => r.user_id === p.id)
      const myPass = myResults.filter((r) => r.result === 'pass').length
      const myFail = myResults.filter((r) => r.result === 'fail').length
      const myFilled = myResults.length
      const myRemaining = Math.max(0, visibleItems.length - myFilled)
      return {
        user_id: p.id,
        name: p.display_name || p.full_name,
        role: ROLE_LABELS[p.role],
        total: visibleItems.length,
        filled: myFilled,
        pass: myPass,
        fail: myFail,
        remaining: myRemaining,
      }
    })
    .sort((a, b) => {
      // 進度高的排上面;同進度時失敗多的排上面(較需要關注)。
      const ap = a.total === 0 ? 0 : a.filled / a.total
      const bp = b.total === 0 ? 0 : b.filled / b.total
      if (bp !== ap) return bp - ap
      return b.fail - a.fail
    })

  // ────────────────────────────────────────────────────────────────────────
  // 失敗項目清單(依失敗人數降冪)
  // ────────────────────────────────────────────────────────────────────────
  const failByItem = new Map<string, ResultRow[]>()
  for (const r of results.filter((r) => r.result === 'fail')) {
    const arr = failByItem.get(r.item_id) ?? []
    arr.push(r)
    failByItem.set(r.item_id, arr)
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const failRows: AdminFailRow[] = []
  failByItem.forEach((fails: ResultRow[], itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    failRows.push({
      item_id: itemId,
      item_code: item.item_code,
      step_description: item.step_description,
      fail_count: fails.length,
      reporters: fails.map((f) => {
        const prof = profileById.get(f.user_id)
        return {
          user_id: f.user_id,
          name: prof ? prof.display_name || prof.full_name : '(未知)',
          note: f.note ?? '',
          screenshot_path: f.screenshot_path,
        }
      }),
    })
  })
  failRows.sort((a, b) => b.fail_count - a.fail_count)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BarChart size={22} className="text-primary" />
            Admin 總覽
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            所有測試人員的填寫進度與失敗項目彙整。
          </p>
        </div>
      </header>

      <AdminClient
        stats={{
          testers: testers.size,
          chapterCompletionRate,
          totalPass,
          totalFail,
        }}
        people={personRows}
        fails={failRows}
      />
    </div>
  )
}
