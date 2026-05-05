'use server'

import { revalidatePath } from 'next/cache'

import { STUDENT_STATUS_CONFIG, type StudentStatus } from '@/lib/constants/student-status'
import { ALLOWED_TRANSITIONS } from '@/lib/constants/student-status-transitions'
import {
  createStudentSchema,
  toDbPayload,
  updateStudentSchema,
  type StudentInput,
} from '@/lib/validators/student'
import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function createStudent(input: StudentInput): Promise<ActionResult> {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { data, error } = await supabase
    .from('students')
    .insert({
      ...toDbPayload(parsed.data),
      // RLS WITH CHECK: created_by must equal auth.uid()
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
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
  const { error } = await supabase
    .from('students')
    .update(toDbPayload(patch as StudentInput))
    .eq('id', parsedId)
    .is('deleted_at', null)

  if (error) {
    return { ok: false, error: `更新失敗:${error.message}` }
  }

  revalidatePath('/students')
  revalidatePath(`/students/${parsedId}`)
  return { ok: true, id: parsedId }
}

export async function changeStudentStatus(
  id: string,
  newStatus: StudentStatus,
  note: string | null,
): Promise<ActionResult> {
  if (!id) return { ok: false, error: '缺少學生 id' }

  const supabase = createClient()

  const { data: current, error: fetchErr } = await supabase
    .from('students')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchErr) return { ok: false, error: fetchErr.message }
  if (!current) return { ok: false, error: '找不到學生(可能已刪除)' }

  const fromStatus = current.status as StudentStatus
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? []
  if (fromStatus === newStatus) {
    return { ok: false, error: '狀態未變更' }
  }
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      error: `不允許從「${STUDENT_STATUS_CONFIG[fromStatus].label}」變更為「${STUDENT_STATUS_CONFIG[newStatus].label}」`,
    }
  }

  // Same SECURITY DEFINER pattern as soft_delete_student (migration 0005).
  // Cast: function not in generated Database types yet — run `npm run gen:types`
  // after the migration is applied to remove the cast.
  const { error } = await supabase.rpc(
    'change_student_status' as never,
    {
      p_id: id,
      p_new_status: newStatus,
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
