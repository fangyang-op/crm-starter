'use server'

import { revalidatePath } from 'next/cache'

import { dealSchema, type DealInput } from '@/lib/validators/deal'
import { createClient } from '@/lib/supabase/server'

export type DealActionResult =
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

export async function createDeal(input: DealInput): Promise<DealActionResult> {
  const parsed = dealSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_deal' as never,
    {
      p_student_id: parsed.data.student_id,
      p_plan_id: parsed.data.plan_id,
      p_extra_school_count: parsed.data.extra_school_count,
      p_extra_word_quota: parsed.data.extra_word_quota,
      p_discount_amount: parsed.data.discount_amount,
      p_discount_reason: parsed.data.discount_reason ?? null,
      p_signed_at: parsed.data.signed_at,
      p_contract_no: parsed.data.contract_no ?? null,
      p_payment_status: parsed.data.payment_status,
      p_notes: parsed.data.notes ?? null,
      p_splits: parsed.data.splits.map((s) => ({
        role_in_deal: s.role_in_deal,
        recipient_user_id: s.recipient_user_id ?? null,
        recipient_referrer_id: s.recipient_referrer_id ?? null,
        percentage: s.percentage,
        notes: s.notes ?? null,
      })),
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立成交失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  revalidatePath('/students')
  return { ok: true, id: data as unknown as string }
}
