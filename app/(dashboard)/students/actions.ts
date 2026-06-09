'use server'

import { revalidatePath } from 'next/cache'

import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import {
  createStudentSchema,
  toDbPayload,
  updateStudentSchema,
  type StudentInput,
} from '@/lib/validators/student'

export type ActionResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: string
      fieldErrors?: Record<string, string[]>
      /** Set when the failure is the phone UNIQUE constraint (PG 23505). The
       *  client uses this to drive the inline "重複名單" UI instead of
       *  showing a generic toast. */
      code?: 'DUPLICATE_PHONE'
    }

/** Optional initial scores captured during 前端建檔. Each row becomes
 *  an academic_scores entry with status='preliminary'. */
export type PreliminaryScoreInput = {
  score_type: string
  total_score: string
  sub_scores?: Record<string, string | number>
}

export type DuplicatePhoneStudent = {
  id: string
  full_name: string
  english_name: string | null
  created_at: string
  frontend_consultant_id: string | null
  frontend_consultant_name: string | null
}

export type DuplicatePhoneResult =
  | { ok: true; isDuplicate: false }
  | {
      ok: true
      isDuplicate: true
      /** Stage 2-A 最小揭露:consultant 呼叫時 RPC 不回傳對方身分,此欄為
       *  null,改由 `message` 帶固定訊息。manager/admin 才會拿到完整資料。 */
      existingStudent: DuplicatePhoneStudent | null
      /** consultant 收到的固定訊息(「此聯繫方式已存在,請聯繫管理員或主管」)。 */
      message?: string
    }
  | { ok: false; error: string }

/** v duplicate-prevention §2A — query the SD function find_duplicate_student_
 *  by_phone (0038, role-aware since 0045). Server-only so we can normalise the
 *  phone server-side; the RPC bypasses RLS via SECURITY DEFINER but, since
 *  0045, withholds the matched student's identity from consultant callers. */
export async function checkPhoneDuplicate(phone: string): Promise<DuplicatePhoneResult> {
  // phone-normalize §1.4: normalize before lookup so 0912-345-678 /
  // +886912345678 / 0912345678 all hit the same canonical row.
  const normalized = normalizePhone(phone)
  if (normalized.length < 8) return { ok: true, isDuplicate: false }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('find_duplicate_student_by_phone', {
    p_phone: normalized,
  })
  if (error) {
    return { ok: false, error: `查詢失敗:${(error as { message: string }).message}` }
  }
  // 0045 — RPC 回傳 JSONB 物件 { is_duplicate, matches, message? }。
  // consultant:matches 為 []、message 帶固定訊息;manager/admin:matches 有 1 筆。
  const res = (data ?? {}) as unknown as {
    is_duplicate?: boolean
    matches?: DuplicatePhoneStudent[]
    message?: string
  }
  if (!res.is_duplicate) return { ok: true, isDuplicate: false }
  const existingStudent = res.matches && res.matches.length > 0 ? res.matches[0] : null
  return { ok: true, isDuplicate: true, existingStudent, message: res.message }
}

/** Override info passed from the form when a manager/admin has eyeballed the
 *  inline duplicate warning and clicked「確認為不同學生,繼續建立」. Stage 2-A
 *  任務三(i):consultant 不可覆寫 — createStudent 會忽略非 manager/admin 帶進來
 *  的 override。被採信時寫入 activity_log(action='duplicate_phone_override')供
 *  §4 主管審查。 */
export type DuplicateOverride = {
  duplicateOfStudentId: string
  phone: string
}

export type ContactPhoneMatch = {
  match_type: 'student' | 'contact'
  match_id: string
  student_id: string
  student_name: string
  contact_name: string | null
  contact_relation: string | null
}

export type ContactPhoneDuplicateResult =
  | { ok: true; isDuplicate: false }
  | {
      ok: true
      isDuplicate: true
      /** Stage 2-A 最小揭露:consultant 呼叫時為 []，改由 `message` 帶固定訊息。 */
      matches: ContactPhoneMatch[]
      message?: string
    }
  | { ok: false; error: string }

/** phone-normalize §3 — scan both `students.phone` and `student_contacts.phone`
 *  for the supplied number (find_phone_anywhere, 0041; role-aware since 0045).
 *  Used by the 代填人 (contact) phone input on the new-student form. Since 0045
 *  the RPC withholds matched identities from consultant callers. */
export async function checkContactPhoneDuplicate(
  phone: string,
): Promise<ContactPhoneDuplicateResult> {
  const normalized = normalizePhone(phone)
  if (normalized.length < 8) return { ok: true, isDuplicate: false }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('find_phone_anywhere', { p_phone: normalized })
  if (error) {
    return { ok: false, error: `查詢失敗:${(error as { message: string }).message}` }
  }
  // 0045 — RPC 回傳 JSONB 物件 { is_duplicate, matches, message? }。
  const res = (data ?? {}) as unknown as {
    is_duplicate?: boolean
    matches?: ContactPhoneMatch[]
    message?: string
  }
  if (!res.is_duplicate) return { ok: true, isDuplicate: false }
  return { ok: true, isDuplicate: true, matches: res.matches ?? [], message: res.message }
}

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function createStudent(
  input: StudentInput,
  preliminaryScores?: PreliminaryScoreInput[],
  duplicateOverride?: DuplicateOverride | null,
): Promise<ActionResult> {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  // Stage 2-A 任務三(i)— 取呼叫者角色。只有 manager/admin 可覆寫重複名單;
  // consultant 一律不可自助覆寫,即使前端被繞過、偽造 duplicateOverride。
  // fail-closed:查不到 profile/role → 視為無覆寫權(canOverride = false)。
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (me as { role?: UserRole } | null)?.role ?? null
  const canOverride = role ? isManagerOrAdmin(role) : false
  // 非 manager/admin 帶進來的 override 不予採信 → 降級為 null,強制走查重。
  const effectiveOverride = canOverride ? (duplicateOverride ?? null) : null

  // Migration 0026 dropped the enum default and made status_id NOT NULL.
  // Look up 'new_lead' (the historical default) and fall back to the
  // lowest-sort active status if an admin renamed/disabled it.
  const { data: defaultStatus } = await supabase
    .from('student_statuses' as never)
    .select('id, code')
    .eq('code' as never, 'new_lead' as never)
    .maybeSingle()
  let defaultStatusId = (defaultStatus as { id?: string } | null)?.id ?? null
  if (!defaultStatusId) {
    const { data: anyActive } = await supabase
      .from('student_statuses' as never)
      .select('id')
      .eq('is_active' as never, true as never)
      .order('sort_order' as never, { ascending: true })
      .limit(1)
      .maybeSingle()
    defaultStatusId = (anyActive as { id?: string } | null)?.id ?? null
  }
  if (!defaultStatusId) {
    return {
      ok: false,
      error:
        '系統未設定學生狀態。請先到「設定 → 學生狀態」新增至少一筆,或把預設的 new_lead 重新啟用。',
    }
  }

  // phone-normalize §1: canonicalise phone before INSERT so DB rows always
  // store '0912345678' regardless of input format ('0912-345-678' / '+886
  // 912 345 678' / '(02) 5580-2586' all collapse). Empty → null.
  const dbPayload = toDbPayload(parsed.data)
  const normalizedPhone = normalizePhone(dbPayload.phone)
  const phoneToStore = normalizedPhone === '' ? null : normalizedPhone

  // duplicate-prevention §2A + Stage 2-A 任務三(i) — app-level 重複偵測。
  // 只有 manager/admin 的覆寫(effectiveOverride)能跳過此擋點;consultant 帶
  // 的 override 已被降級為 null → 一律走查重並擋下(伺服器端縱深防禦,不可
  // 只靠前端隱藏按鈕)。0037 的 DB-level UNIQUE 已在 0044 移除,這裡是唯一擋點。
  if (!effectiveOverride && phoneToStore) {
    const dup = await checkPhoneDuplicate(phoneToStore)
    // Fail-closed — 0044 移除 phone UNIQUE 後,此查重是唯一安全網。若 RPC 查詢
    // 失敗(未部署 / PostgREST schema 未 reload / 連線瞬斷),不可放行,否則會
    // 靜默建立重複名單;一律擋下並請使用者稍後再試。
    if (!dup.ok) {
      return { ok: false, error: '重複檢查暫時無法執行,請稍後再試。' }
    }
    if (dup.isDuplicate) {
      // 最小揭露:consultant 用通用語、不透露對方身分;manager/admin 維持原
      // 訊息(他們本就能看到完整重複資訊)。兩者皆不含可識別個資。
      const dupMsg = canOverride
        ? '此手機號碼已有學生名單存在,請先搜尋現有名單。'
        : '此聯繫方式已存在,請聯繫管理員或主管。'
      return {
        ok: false,
        error: dupMsg,
        code: 'DUPLICATE_PHONE',
        fieldErrors: { phone: [dupMsg] },
      }
    }
  }

  const payload = {
    ...dbPayload,
    phone: phoneToStore,
    // RLS WITH CHECK: created_by must equal auth.uid()
    created_by: user.id,
    // Required since 0026 — codegen may not have caught up so cast through never.
    status_id: defaultStatusId,
  } as never
  const { data, error } = await supabase.from('students').insert(payload).select('id').single()

  if (error) {
    // 0044 後 students 已沒有 phone UNIQUE,但其他欄位若有 UNIQUE
    // 仍會走 23505。保留作防禦性 fallback。
    if ((error as { code?: string }).code === '23505') {
      return {
        ok: false,
        error: '此手機號碼已有學生名單存在,請先搜尋現有名單。',
        code: 'DUPLICATE_PHONE',
        fieldErrors: { phone: ['此手機號碼已有學生名單存在'] },
      }
    }
    return { ok: false, error: `建立失敗:${error.message}` }
  }

  // Log to activity_log so timeline shows the creation event. Failure is
  // non-fatal — student exists; we just won't have a timeline entry.
  await supabase.from('activity_log').insert({
    student_id: data.id,
    actor_id: user.id,
    action: 'student_created',
    entity_type: 'student',
    entity_id: data.id,
  })

  // duplicate-prevention §2A + Stage 2-A 任務三(i) — 只有 manager/admin 能覆寫,
  // 故只在 effectiveOverride 存在時記錄,供 §4 主管 widget /「重複名單覆蓋紀錄」
  // 頁審查。Best-effort(非致命),理由同上方 student_created。
  if (effectiveOverride) {
    await supabase.from('activity_log').insert({
      student_id: data.id,
      actor_id: user.id,
      action: 'duplicate_phone_override',
      entity_type: 'student',
      entity_id: data.id,
      payload: {
        duplicate_of_student_id: effectiveOverride.duplicateOfStudentId,
        // Log the canonical phone so the 主管 widget shows the same value
        // regardless of how the user typed it.
        phone: normalizePhone(effectiveOverride.phone) || effectiveOverride.phone,
        // 記錄核可者角色,供主管審查「誰以什麼權限覆寫」。
        reason: 'confirmed_different_by_manager_or_admin',
        overridden_by_role: role,
      },
    })
  }

  // Optional preliminary scores — best-effort. If a row fails (e.g. invalid
  // score_type), we keep going so the student creation isn't blocked. The
  // back-end can fix individual rows later.
  if (preliminaryScores && preliminaryScores.length > 0) {
    for (const s of preliminaryScores) {
      if (!s.total_score?.trim()) continue
      await supabase.rpc(
        'create_preliminary_score' as never,
        {
          p_student_id: data.id,
          p_score_type: s.score_type,
          p_total_score: s.total_score,
          p_sub_scores: s.sub_scores ?? null,
        } as never,
      )
    }
  }

  revalidatePath('/students')
  return { ok: true, id: data.id }
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: '缺少學生 id' }

  const parsed = updateStudentSchema.safeParse({ id, ...input })
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { id: parsedId, ...patch } = parsed.data

  // phone-normalize §1: same canonicalisation as createStudent.
  const dbPatch = toDbPayload(patch as StudentInput)
  const normalizedPhone = normalizePhone(dbPatch.phone)
  const finalPatch = {
    ...dbPatch,
    phone: normalizedPhone === '' ? null : normalizedPhone,
  }

  // SECURITY DEFINER (migration 0007) — direct UPDATE under RLS WITH CHECK
  // misbehaves for admin (same quirk as soft delete). The function also writes
  // consultant_handovers + activity_log entries when frontend / backend
  // consultant ids change.
  const { error } = await supabase.rpc(
    'update_student' as never,
    {
      p_id: parsedId,
      p_data: finalPatch,
    } as never,
  )

  if (error) {
    // §5 (duplicate-prevention): also handle 23505 here in case an editor
    // tries to overwrite their phone with one that already belongs to
    // another student. Same friendly message as createStudent.
    if ((error as { code?: string }).code === '23505') {
      return {
        ok: false,
        error: '此手機號碼已有其他學生使用,請確認後再儲存。',
      }
    }
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/students')
  revalidatePath(`/students/${parsedId}`)
  return { ok: true, id: parsedId }
}

export async function changeStudentStatus(
  id: string,
  newStatusId: string,
  note: string | null,
): Promise<ActionResult> {
  if (!id) return { ok: false, error: '缺少學生 id' }
  if (!newStatusId) return { ok: false, error: '缺少目標狀態' }

  const supabase = await createClient()

  // Spec § 2.2 MVP: any → any (admin owns the whitelist now). The SD function
  // also rejects "no-op" and "unknown status" errors, so we don't double-check.
  const { error } = await supabase.rpc(
    'change_student_status' as never,
    {
      p_id: id,
      p_new_status_id: newStatusId,
      p_note: note,
    } as never,
  )

  if (error) {
    return { ok: false, error: `變更失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/students')
  revalidatePath(`/students/${id}`)
  return { ok: true, id }
}

export async function softDeleteStudent(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: '缺少學生 id' }

  const supabase = await createClient()

  // Goes through SECURITY DEFINER function (migration 0004) because direct
  // UPDATE under RLS WITH CHECK returned "new row violates RLS" for admin
  // even with role=admin and is_manager_or_admin() returning true. The
  // function does its own permission check in plpgsql before updating.
  // Cast: function not in generated Database types yet — run `npm run gen:types`
  // after this migration has been applied to remove the cast.
  const { error } = await supabase.rpc(
    'soft_delete_student' as never,
    {
      p_id: id,
    } as never,
  )

  if (error) {
    return { ok: false, error: `刪除失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/students')
  return { ok: true, id }
}
