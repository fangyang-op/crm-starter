'use server'

import { revalidatePath } from 'next/cache'

import {
  addSchoolListItemSchema,
  newSchoolListSchema,
  type AddSchoolListItemInput,
  type NewSchoolListInput,
} from '@/lib/validators/school-list'
import type { Tier } from '@/lib/constants/tier'
import { createClient } from '@/lib/supabase/server'

export type SchoolListActionResult =
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

export async function createSchoolList(input: NewSchoolListInput): Promise<SchoolListActionResult> {
  const parsed = newSchoolListSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_school_list' as never,
    {
      p_student_id: parsed.data.student_id,
      p_name: parsed.data.name,
      p_copy_from_list_id: parsed.data.copy_from_list_id ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  return { ok: true, id: data as unknown as string }
}

export async function lockSchoolList(
  studentId: string,
  listId: string,
): Promise<SchoolListActionResult> {
  if (!listId) return { ok: false, error: '缺少 list id' }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'lock_school_list' as never,
    {
      p_id: listId,
    } as never,
  )

  if (error) {
    return { ok: false, error: `鎖定失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: listId }
}

export async function setCurrentSchoolList(
  studentId: string,
  listId: string,
): Promise<SchoolListActionResult> {
  if (!listId) return { ok: false, error: '缺少 list id' }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'set_current_school_list' as never,
    {
      p_id: listId,
    } as never,
  )

  if (error) {
    return { ok: false, error: `設定失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: listId }
}

export async function addSchoolListItem(
  studentId: string,
  input: AddSchoolListItemInput,
): Promise<SchoolListActionResult> {
  const parsed = addSchoolListItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'add_school_list_item' as never,
    {
      p_list_id: parsed.data.school_list_id,
      p_school_id: parsed.data.school_id,
      p_program_id: parsed.data.program_id ?? null,
      p_program_name_override: parsed.data.program_name_override ?? null,
      p_tier: parsed.data.tier,
      p_notes: parsed.data.notes ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `加入失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: data as unknown as string }
}

export async function updateSchoolListItem(
  studentId: string,
  itemId: string,
  tier: Tier,
  displayOrder: number,
  notes: string | null,
): Promise<SchoolListActionResult> {
  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_school_list_item' as never,
    {
      p_id: itemId,
      p_tier: tier,
      p_display_order: displayOrder,
      p_notes: notes,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: itemId }
}

export async function removeSchoolListItem(
  studentId: string,
  itemId: string,
): Promise<SchoolListActionResult> {
  const supabase = createClient()
  const { error } = await supabase.rpc(
    'remove_school_list_item' as never,
    {
      p_id: itemId,
    } as never,
  )

  if (error) {
    return { ok: false, error: `移除失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: itemId }
}
