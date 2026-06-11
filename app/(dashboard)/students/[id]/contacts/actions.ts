'use server'

import { revalidatePath } from 'next/cache'
import type { ZodError } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

import { studentContactSchema, type ContactActionResult, type StudentContactInput } from './schema'

// types-only re-export so callers can keep importing from './actions' as
// before. 'use server' files can't export non-async runtime values, so
// schema/constants live in ./schema and only async functions are exported
// here. Type re-exports are erased at compile time so they're safe.
export type { ContactRelation, ContactActionResult, StudentContactInput } from './schema'

function flattenZodErrors(err: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function addStudentContact(
  studentId: string,
  input: StudentContactInput,
): Promise<ContactActionResult> {
  if (!studentId) return { ok: false, error: '缺少學生 id' }

  const parsed = studentContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  // phone-normalize §1 — canonicalise contact phone before INSERT.
  const normalizedPhone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null
  const insertRow = {
    student_id: studentId,
    ...parsed.data,
    phone: normalizedPhone === '' ? null : normalizedPhone,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('student_contacts' as never)
    .insert(insertRow as never)
    .select('id' as never)
    .single()

  if (error) {
    return { ok: false, error: `新增失敗:${(error as { message: string }).message}` }
  }

  await supabase.from('activity_log').insert({
    student_id: studentId,
    actor_id: user.id,
    action: 'contact_added',
    entity_type: 'student_contact',
    entity_id: (data as { id: string }).id,
    payload: {
      relation: parsed.data.relation,
      name: parsed.data.name,
      is_primary_contact: parsed.data.is_primary_contact ?? false,
    },
  })

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: (data as { id: string }).id }
}

export async function updateStudentContact(
  contactId: string,
  studentId: string,
  input: StudentContactInput,
): Promise<ContactActionResult> {
  if (!contactId) return { ok: false, error: '缺少關係人 id' }

  const parsed = studentContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const normalizedPhone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null
  const updateRow = {
    ...parsed.data,
    phone: normalizedPhone === '' ? null : normalizedPhone,
  }

  const { error } = await supabase
    .from('student_contacts' as never)
    .update(updateRow as never)
    .eq('id' as never, contactId as never)

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  await supabase.from('activity_log').insert({
    student_id: studentId,
    actor_id: user.id,
    action: 'contact_updated',
    entity_type: 'student_contact',
    entity_id: contactId,
    payload: {
      relation: parsed.data.relation,
      name: parsed.data.name,
    },
  })

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: contactId }
}

export async function deleteStudentContact(
  contactId: string,
  studentId: string,
): Promise<ContactActionResult> {
  if (!contactId) return { ok: false, error: '缺少關係人 id' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { error } = await supabase
    .from('student_contacts' as never)
    .delete()
    .eq('id' as never, contactId as never)

  if (error) {
    return { ok: false, error: `刪除失敗:${(error as { message: string }).message}` }
  }

  await supabase.from('activity_log').insert({
    student_id: studentId,
    actor_id: user.id,
    action: 'contact_removed',
    entity_type: 'student_contact',
    entity_id: contactId,
    payload: {},
  })

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: contactId }
}
