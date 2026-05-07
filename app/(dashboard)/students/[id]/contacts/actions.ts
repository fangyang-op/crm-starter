'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const RELATION_VALUES = ['父親', '母親', '監護人', '親戚', '其他'] as const
export type ContactRelation = (typeof RELATION_VALUES)[number]

export const studentContactSchema = z.object({
  relation: z.enum(RELATION_VALUES),
  name: z.string().min(1, '請填寫姓名').max(100),
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  email: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'email 格式錯誤'),
  line_id: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  is_primary_contact: z.boolean().optional().default(false),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
})

export type StudentContactInput = z.infer<typeof studentContactSchema>

export type ContactActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

function flattenZodErrors(err: z.ZodError): Record<string, string[]> {
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

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { data, error } = await supabase
    .from('student_contacts' as never)
    .insert({
      student_id: studentId,
      ...parsed.data,
      created_by: user.id,
    } as never)
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

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { error } = await supabase
    .from('student_contacts' as never)
    .update(parsed.data as never)
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

  const supabase = createClient()
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
