'use server'

import { revalidatePath } from 'next/cache'

import {
  createStudentSchema,
  toDbPayload,
  updateStudentSchema,
  type StudentInput,
} from '@/lib/validators/student'
import { createClient } from '@/lib/supabase/server'

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
): Promise<ActionResult> {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

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

  const payload = {
    ...toDbPayload(parsed.data),
    // RLS WITH CHECK: created_by must equal auth.uid()
    created_by: user.id,
    // Required since 0026 — codegen may not have caught up so cast through never.
    status_id: defaultStatusId,
  } as never
  const { data, error } = await supabase.from('students').insert(payload).select('id').single()

  if (error) {
    // duplicate-prevention §5: PG 23505 = unique_violation. Migration 0037
    // adds students_phone_unique. Surface as a typed error so the form can
    // render the inline duplicate UI instead of a generic toast.
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

  const supabase = createClient()
  const { id: parsedId, ...patch } = parsed.data

  // SECURITY DEFINER (migration 0007) — direct UPDATE under RLS WITH CHECK
  // misbehaves for admin (same quirk as soft delete). The function also writes
  // consultant_handovers + activity_log entries when frontend / backend
  // consultant ids change.
  const { error } = await supabase.rpc(
    'update_student' as never,
    {
      p_id: parsedId,
      p_data: toDbPayload(patch as StudentInput),
    } as never,
  )

  if (error) {
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

  const supabase = createClient()

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

  const supabase = createClient()

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
