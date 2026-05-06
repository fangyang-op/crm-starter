'use server'

import { revalidatePath } from 'next/cache'

import { wordQuotaBonusSchema, type WordQuotaBonusInput } from '@/lib/validators/word-quota'
import { createClient } from '@/lib/supabase/server'

export type WordQuotaActionResult =
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

export async function addWordQuotaBonus(
  input: WordQuotaBonusInput,
): Promise<WordQuotaActionResult> {
  const parsed = wordQuotaBonusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'add_word_quota_bonus' as never,
    {
      p_student_id: parsed.data.student_id,
      p_amount: parsed.data.amount,
      p_description: parsed.data.description,
    } as never,
  )

  if (error) {
    return { ok: false, error: `加碼失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  return { ok: true, id: data as unknown as string }
}
