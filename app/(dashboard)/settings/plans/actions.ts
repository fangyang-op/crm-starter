'use server'

import { revalidatePath } from 'next/cache'

import { planSchema, type PlanInput } from '@/lib/validators/plan'
import { createClient } from '@/lib/supabase/server'

export type PlanActionResult =
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

export async function createServicePlan(input: PlanInput): Promise<PlanActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_service_plan' as never,
    {
      p_code: parsed.data.code,
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_base_price: parsed.data.base_price,
      p_currency: parsed.data.currency,
      p_included_school_count: parsed.data.included_school_count ?? null,
      p_included_word_quota: parsed.data.included_word_quota ?? null,
      p_scope_country: parsed.data.scope_country ?? null,
      p_scope_degree: parsed.data.scope_degree ?? null,
      p_is_active: parsed.data.is_active,
      p_display_order: parsed.data.display_order,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/plans')
  return { ok: true, id: data as unknown as string }
}

export async function updateServicePlan(id: string, input: PlanInput): Promise<PlanActionResult> {
  if (!id) return { ok: false, error: '缺少 id' }
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_service_plan' as never,
    {
      p_id: id,
      p_code: parsed.data.code,
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_base_price: parsed.data.base_price,
      p_currency: parsed.data.currency,
      p_included_school_count: parsed.data.included_school_count ?? null,
      p_included_word_quota: parsed.data.included_word_quota ?? null,
      p_scope_country: parsed.data.scope_country ?? null,
      p_scope_degree: parsed.data.scope_degree ?? null,
      p_is_active: parsed.data.is_active,
      p_display_order: parsed.data.display_order,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/plans')
  return { ok: true, id }
}
