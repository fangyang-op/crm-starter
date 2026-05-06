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

  const payload = {
    ...toDbPayload(parsed.data),
    // RLS WITH CHECK: created_by must equal auth.uid()
    created_by: user.id,
  } as never
  const { data, error } = await supabase.from('students').insert(payload).select('id').single()

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
