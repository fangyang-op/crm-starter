'use server'

import { revalidatePath } from 'next/cache'

import { referrerSchema, type ReferrerInput } from '@/lib/validators/referrer'
import { createClient } from '@/lib/supabase/server'

export type ReferrerActionResult =
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

export async function createReferrer(input: ReferrerInput): Promise<ReferrerActionResult> {
  const parsed = referrerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  // 6-arg variant from migration 0022 — adds default_split_percent.
  const { data, error } = await supabase.rpc(
    'create_referrer' as never,
    {
      p_name: parsed.data.name,
      p_type: parsed.data.type,
      p_contact_email: parsed.data.contact_email ?? null,
      p_contact_phone: parsed.data.contact_phone ?? null,
      p_default_split_percent: parsed.data.default_split_percent ?? null,
      p_notes: parsed.data.notes ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/referrers')
  return { ok: true, id: data as unknown as string }
}

export async function updateReferrer(
  id: string,
  input: ReferrerInput,
): Promise<ReferrerActionResult> {
  if (!id) return { ok: false, error: '缺少 id' }

  const parsed = referrerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'update_referrer' as never,
    {
      p_id: id,
      p_name: parsed.data.name,
      p_type: parsed.data.type,
      p_contact_email: parsed.data.contact_email ?? null,
      p_contact_phone: parsed.data.contact_phone ?? null,
      p_default_split_percent: parsed.data.default_split_percent ?? null,
      p_notes: parsed.data.notes ?? null,
      p_is_active: parsed.data.is_active,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/referrers')
  return { ok: true, id }
}
