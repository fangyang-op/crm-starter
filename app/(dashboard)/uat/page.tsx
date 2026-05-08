import { redirect } from 'next/navigation'

import { ClipboardCheck } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/constants/roles'

import { UatClient, type UatChapterDto } from './uat-client'

export const metadata = { title: '測試回報 — 放洋全端 CRM 平台' }

type ChapterRow = {
  id: string
  sort_order: number
  title_zh: string
  icon: string
  description: string
  target_roles: string[] | null
  is_active: boolean
}

type ItemRow = {
  id: string
  chapter_id: string
  sort_order: number
  item_code: string
  step_description: string
  expected_result: string
  is_active: boolean
}

type ResultRow = {
  item_id: string
  result: 'pass' | 'fail'
  note: string | null
  screenshot_path: string | null
}

export default async function UatPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, display_name')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')
  const role = (profile as { role: UserRole }).role

  // uat-portal §4.3 — 三段獨立查詢比 nested select 好維護(types 也乾淨)。
  const [{ data: chaptersRaw }, { data: itemsRaw }, { data: resultsRaw }] = await Promise.all([
    supabase
      .from('uat_chapters' as never)
      .select('id, sort_order, title_zh, icon, description, target_roles, is_active')
      .eq('is_active' as never, true as never)
      .order('sort_order' as never, { ascending: true }),
    supabase
      .from('uat_items' as never)
      .select('id, chapter_id, sort_order, item_code, step_description, expected_result, is_active')
      .eq('is_active' as never, true as never)
      .order('sort_order' as never, { ascending: true }),
    supabase
      .from('uat_results' as never)
      .select('item_id, result, note, screenshot_path')
      .eq('user_id' as never, user.id as never),
  ])

  const allChapters = (chaptersRaw ?? []) as unknown as ChapterRow[]
  const allItems = (itemsRaw ?? []) as unknown as ItemRow[]
  const results = (resultsRaw ?? []) as unknown as ResultRow[]

  // target_roles 為空陣列 = 所有角色都看得到;非空則需角色在內。
  const visibleChapters = allChapters.filter(
    (c) => !c.target_roles || c.target_roles.length === 0 || c.target_roles.includes(role),
  )

  const resultByItem = new Map(results.map((r) => [r.item_id, r]))

  const chapters: UatChapterDto[] = visibleChapters.map((c) => {
    const items = allItems
      .filter((i) => i.chapter_id === c.id)
      .map((i) => ({
        id: i.id,
        item_code: i.item_code,
        step_description: i.step_description,
        expected_result: i.expected_result,
        result: resultByItem.get(i.id)?.result ?? null,
        note: resultByItem.get(i.id)?.note ?? '',
        screenshot_path: resultByItem.get(i.id)?.screenshot_path ?? null,
      }))
    return {
      id: c.id,
      title_zh: c.title_zh,
      icon: c.icon,
      description: c.description,
      items,
    }
  })

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardCheck size={22} className="text-primary" />
          內部封測回報
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          請依章節逐項測試,選擇通過/失敗並選填備註與截圖。系統會自動儲存,
          可隨時關掉視窗下次回來繼續。
        </p>
      </header>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong className="font-semibold">封測注意事項</strong>
        :學生 Portal / 轉介人 Portal 尚未開放;2.12 一鍵打包仍在開發中。
      </div>

      {chapters.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
          目前沒有任何測試章節 — 請聯絡 Admin 確認資料是否已 seed。
        </div>
      ) : (
        <UatClient chapters={chapters} />
      )}
    </div>
  )
}
