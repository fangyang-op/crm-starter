'use server'

import { revalidatePath } from 'next/cache'

import {
  schoolSchema,
  schoolProgramSchema,
  type SchoolInput,
  type SchoolProgramInput,
} from '@/lib/validators/school'
import { createClient } from '@/lib/supabase/server'

export type SchoolActionResult =
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

export async function createSchool(input: SchoolInput): Promise<SchoolActionResult> {
  const parsed = schoolSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_school' as never,
    {
      p_name_en: parsed.data.name_en,
      p_name_zh: parsed.data.name_zh ?? null,
      p_short_name: parsed.data.short_name ?? null,
      p_country: parsed.data.country,
      p_state_or_region: parsed.data.state_or_region ?? null,
      p_city: parsed.data.city ?? null,
      p_website: parsed.data.website ?? null,
      p_ranking_qs: parsed.data.ranking_qs ?? null,
      p_ranking_us_news: parsed.data.ranking_us_news ?? null,
      p_is_partner: parsed.data.is_partner,
      p_partner_commission_rate: parsed.data.partner_commission_rate ?? null,
      p_partner_notes: parsed.data.partner_notes ?? null,
      p_is_active: parsed.data.is_active,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/schools')
  return { ok: true, id: data as unknown as string }
}

export async function updateSchool(id: string, input: SchoolInput): Promise<SchoolActionResult> {
  if (!id) return { ok: false, error: '缺少 id' }
  const parsed = schoolSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_school' as never,
    {
      p_id: id,
      p_name_en: parsed.data.name_en,
      p_name_zh: parsed.data.name_zh ?? null,
      p_short_name: parsed.data.short_name ?? null,
      p_country: parsed.data.country,
      p_state_or_region: parsed.data.state_or_region ?? null,
      p_city: parsed.data.city ?? null,
      p_website: parsed.data.website ?? null,
      p_ranking_qs: parsed.data.ranking_qs ?? null,
      p_ranking_us_news: parsed.data.ranking_us_news ?? null,
      p_is_partner: parsed.data.is_partner,
      p_partner_commission_rate: parsed.data.partner_commission_rate ?? null,
      p_partner_notes: parsed.data.partner_notes ?? null,
      p_is_active: parsed.data.is_active,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/schools')
  revalidatePath(`/schools/${id}`)
  return { ok: true, id }
}

export async function createSchoolProgram(input: SchoolProgramInput): Promise<SchoolActionResult> {
  const parsed = schoolProgramSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_school_program' as never,
    {
      p_school_id: parsed.data.school_id,
      p_program_name: parsed.data.program_name,
      p_degree_level: parsed.data.degree_level,
      p_major_category: parsed.data.major_category ?? null,
      p_application_deadline_round1: parsed.data.application_deadline_round1 ?? null,
      p_application_deadline_round2: parsed.data.application_deadline_round2 ?? null,
      p_notes: parsed.data.notes ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/schools/${parsed.data.school_id}`)
  return { ok: true, id: data as unknown as string }
}

export async function updateSchoolProgram(
  programId: string,
  input: SchoolProgramInput,
): Promise<SchoolActionResult> {
  if (!programId) return { ok: false, error: '缺少 id' }
  const parsed = schoolProgramSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_school_program' as never,
    {
      p_id: programId,
      p_program_name: parsed.data.program_name,
      p_degree_level: parsed.data.degree_level,
      p_major_category: parsed.data.major_category ?? null,
      p_application_deadline_round1: parsed.data.application_deadline_round1 ?? null,
      p_application_deadline_round2: parsed.data.application_deadline_round2 ?? null,
      p_notes: parsed.data.notes ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/schools/${parsed.data.school_id}`)
  return { ok: true, id: programId }
}
