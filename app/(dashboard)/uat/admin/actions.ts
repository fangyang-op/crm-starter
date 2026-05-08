'use server'

import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, type UserRole } from '@/lib/constants/roles'

const SCREENSHOT_BUCKET = 'uat-screenshots'

export type AdminCsvResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string }

/** uat-portal §5.2 — server-side 產出 CSV 字串。Admin only(server action
 *  自己再做一次 role check,避免有人直接呼叫繞過頁面)。signed url 短效,
 *  匯出當下產出,使用者下載 CSV 後 60 秒內點得開。*/
export async function exportUatCsv(): Promise<AdminCsvResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (me as { role: UserRole } | null)?.role
  if (role !== 'admin') return { ok: false, error: '只有 Admin 可匯出' }

  const [{ data: results }, { data: items }, { data: chapters }, { data: profiles }] =
    await Promise.all([
      supabase
        .from('uat_results' as never)
        .select('id, item_id, user_id, result, note, screenshot_path, submitted_at'),
      supabase.from('uat_items' as never).select('id, chapter_id, item_code, step_description'),
      supabase.from('uat_chapters' as never).select('id, title_zh'),
      supabase.from('profiles').select('id, full_name, display_name, role'),
    ])

  type Row = {
    item_id: string
    user_id: string
    result: 'pass' | 'fail'
    note: string | null
    screenshot_path: string | null
    submitted_at: string
  }
  type Item = { id: string; chapter_id: string; item_code: string; step_description: string }
  type Chapter = { id: string; title_zh: string }
  type Profile = { id: string; full_name: string; display_name: string | null; role: UserRole }

  const itemMap = new Map(((items ?? []) as unknown as Item[]).map((i) => [i.id, i]))
  const chapterMap = new Map(((chapters ?? []) as unknown as Chapter[]).map((c) => [c.id, c]))
  const profileMap = new Map(((profiles ?? []) as unknown as Profile[]).map((p) => [p.id, p]))

  const rows = (results ?? []) as unknown as Row[]

  // 為每個帶截圖的 row 產一個 60s signed URL。Promise.all 平行,但量大時
  // (ex. >100 截圖) 會拖慢 — admin 端可以接受,封測規模通常 <50 row。
  const signedUrls = await Promise.all(
    rows.map(async (r) => {
      if (!r.screenshot_path) return ''
      const { data } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .createSignedUrl(r.screenshot_path, 60)
      return data?.signedUrl ?? ''
    }),
  )

  const escape = (v: string | null | undefined): string => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const header = [
    '姓名',
    '角色',
    '章節',
    '項目編號',
    '測試步驟',
    '結果',
    '備註',
    '截圖連結',
    '填寫時間',
  ]
  const lines: string[] = [header.map(escape).join(',')]

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx]
    if (!r) continue
    const item = itemMap.get(r.item_id)
    const chapter = item ? chapterMap.get(item.chapter_id) : null
    const profile = profileMap.get(r.user_id)
    const name = profile ? profile.display_name || profile.full_name : '(未知)'
    const roleLabel = profile ? ROLE_LABELS[profile.role] : ''
    const fillTime = new Date(r.submitted_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    lines.push(
      [
        name,
        roleLabel,
        chapter?.title_zh ?? '',
        item?.item_code ?? '',
        item?.step_description ?? '',
        r.result === 'pass' ? '通過' : '失敗',
        r.note ?? '',
        signedUrls[idx] ?? '',
        fillTime,
      ]
        .map(escape)
        .join(','),
    )
  }

  // BOM 讓 Excel 正確識別 UTF-8。
  const csv = '﻿' + lines.join('\r\n')
  const ts = new Date().toISOString().slice(0, 10)
  return { ok: true, csv, filename: `uat-results-${ts}.csv` }
}
