'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

const SCREENSHOT_BUCKET = 'uat-screenshots'

export type UatResult = 'pass' | 'fail'

export type UatActionResult =
  | { ok: true; id: string; screenshot_path?: string | null }
  | { ok: false; error: string }

export type UatSignedUrlResult = { ok: true; url: string } | { ok: false; error: string }

/** uat-portal §4.2 — upsert 一筆結果。每人每項只能一筆(UNIQUE),所以
 *  用 onConflict='item_id,user_id' 直接覆蓋。note 留空時寫 null,避免
 *  之後查詢時 '' 與 null 混用。 */
export async function upsertUatResult(
  itemId: string,
  result: UatResult,
  note: string | null,
): Promise<UatActionResult> {
  if (!itemId) return { ok: false, error: '缺少測試項目 id' }
  if (result !== 'pass' && result !== 'fail') {
    return { ok: false, error: '結果必須是 pass 或 fail' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const trimmed = note?.trim() ?? ''
  const payload = {
    item_id: itemId,
    user_id: user.id,
    result,
    note: trimmed === '' ? null : trimmed,
  } as never

  const { data, error } = await supabase
    .from('uat_results' as never)
    .upsert(payload, { onConflict: 'item_id,user_id' })
    .select('id, screenshot_path')
    .single()

  if (error) {
    return { ok: false, error: `儲存失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/uat')
  const row = data as unknown as { id: string; screenshot_path: string | null }
  return { ok: true, id: row.id, screenshot_path: row.screenshot_path }
}

/** uat-portal §4.2 — 上傳截圖,寫入 path 到對應結果列。需要先有結果列
 *  (即先按過 pass / fail),所以前端要等 upsertUatResult 完成再呼叫。 */
export async function uploadUatScreenshot(
  itemId: string,
  formData: FormData,
): Promise<UatActionResult> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '請選擇檔案' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: '檔案不能超過 5MB' }
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: '請上傳圖片格式' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  // path: <user_id>/<item_id>-<timestamp>.<ext> — bucket policy 預期
  // 第一段 = auth.uid() 才允許 INSERT。
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${user.id}/${itemId}-${ts}.${ext}`

  const { error: upErr } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) {
    return { ok: false, error: `上傳失敗:${upErr.message}` }
  }

  // 更新對應結果列的 screenshot_path。RLS 已限制 user_id = auth.uid()。
  const { data, error } = await supabase
    .from('uat_results' as never)
    .update({ screenshot_path: path } as never)
    .eq('item_id' as never, itemId as never)
    .eq('user_id' as never, user.id as never)
    .select('id, screenshot_path')
    .single()

  if (error) {
    // 結果列還沒建,把剛上傳的檔砍掉避免孤兒。
    await supabase.storage.from(SCREENSHOT_BUCKET).remove([path])
    return {
      ok: false,
      error: `更新失敗(請先選擇通過/失敗):${(error as { message: string }).message}`,
    }
  }

  revalidatePath('/uat')
  const row = data as unknown as { id: string; screenshot_path: string | null }
  return { ok: true, id: row.id, screenshot_path: row.screenshot_path }
}

/** 取得截圖 signed URL,給 <img> 用。60 秒短效,前端每次預覽都重抓。 */
export async function getUatScreenshotSignedUrl(path: string): Promise<UatSignedUrlResult> {
  if (!path) return { ok: false, error: '缺少檔案路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 60)
  if (error || !data) {
    return { ok: false, error: `取得連結失敗:${error?.message ?? '未知錯誤'}` }
  }
  return { ok: true, url: data.signedUrl }
}
