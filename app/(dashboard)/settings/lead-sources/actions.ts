'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export type LeadSourceActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export type LeadSourceSimpleResult = { ok: true } | { ok: false; error: string }

const leadSourceSchema = z.object({
  code: z
    .string()
    .min(1, '代號必填')
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/i, '代號只能用英數與底線,且需以字母開頭'),
  label_zh: z.string().min(1, '中文名稱必填').max(100),
  default_referrer_id: z.string().uuid().nullable(),
  sort_order: z.number().int().min(0).max(99999),
})

export type LeadSourceInput = z.infer<typeof leadSourceSchema>

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function createLeadSource(input: LeadSourceInput): Promise<LeadSourceActionResult> {
  const parsed = leadSourceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_lead_source' as never,
    {
      p_code: parsed.data.code,
      p_label_zh: parsed.data.label_zh,
      p_default_referrer_id: parsed.data.default_referrer_id,
      p_sort_order: parsed.data.sort_order,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/lead-sources')
  return { ok: true, id: data as unknown as string }
}

export async function updateLeadSource(
  id: string,
  input: LeadSourceInput & { is_active: boolean },
): Promise<LeadSourceActionResult> {
  if (!id) return { ok: false, error: '缺少 id' }

  const parsed = leadSourceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_lead_source' as never,
    {
      p_id: id,
      p_code: parsed.data.code,
      p_label_zh: parsed.data.label_zh,
      p_default_referrer_id: parsed.data.default_referrer_id,
      p_sort_order: parsed.data.sort_order,
      p_is_active: input.is_active,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/lead-sources')
  return { ok: true, id }
}

export async function setLeadSourceActive(
  id: string,
  isActive: boolean,
): Promise<LeadSourceSimpleResult> {
  if (!id) return { ok: false, error: '缺少 id' }

  const supabase = createClient()
  // Re-emit existing fields so we don't lose them. The SD function does a
  // full UPDATE, so we read the row first.
  const { data: currentRaw } = await supabase
    .from('lead_sources' as never)
    .select('code, label_zh, default_referrer_id, sort_order')
    .eq('id' as never, id as never)
    .maybeSingle()
  const current = currentRaw as unknown as {
    code: string
    label_zh: string
    default_referrer_id: string | null
    sort_order: number
  } | null
  if (!current) return { ok: false, error: '找不到名單來源' }

  const { error } = await supabase.rpc(
    'update_lead_source' as never,
    {
      p_id: id,
      p_code: current.code,
      p_label_zh: current.label_zh,
      p_default_referrer_id: current.default_referrer_id,
      p_sort_order: current.sort_order,
      p_is_active: isActive,
    } as never,
  )
  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/lead-sources')
  return { ok: true }
}
