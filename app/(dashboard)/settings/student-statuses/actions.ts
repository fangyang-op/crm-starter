'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export type StudentStatusActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

const studentStatusSchema = z.object({
  code: z
    .string()
    .min(1, '代號必填')
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/i, '代號只能用英數與底線,且需以字母開頭'),
  label_zh: z.string().min(1, '中文名稱必填').max(100),
  category: z.enum(['recruitment', 'closed', 'application', 'special']),
  color_key: z.string().min(1).max(40),
  sort_order: z.number().int().min(0).max(99999),
})

export type StudentStatusInput = z.infer<typeof studentStatusSchema>

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function createStudentStatus(
  input: StudentStatusInput,
): Promise<StudentStatusActionResult> {
  const parsed = studentStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_student_status' as never,
    {
      p_code: parsed.data.code,
      p_label_zh: parsed.data.label_zh,
      p_category: parsed.data.category,
      p_color_key: parsed.data.color_key,
      p_sort_order: parsed.data.sort_order,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/student-statuses')
  return { ok: true, id: data as unknown as string }
}

export async function updateStudentStatus(
  id: string,
  input: StudentStatusInput & { is_active: boolean },
): Promise<StudentStatusActionResult> {
  if (!id) return { ok: false, error: '缺少 id' }

  const parsed = studentStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_student_status' as never,
    {
      p_id: id,
      p_code: parsed.data.code,
      p_label_zh: parsed.data.label_zh,
      p_category: parsed.data.category,
      p_color_key: parsed.data.color_key,
      p_sort_order: parsed.data.sort_order,
      p_is_active: input.is_active,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/student-statuses')
  return { ok: true, id }
}
