'use server'

import { revalidatePath } from 'next/cache'

import { calculateWordDiff } from '@/lib/word-diff'
import {
  forkVariantSchema,
  newMasterSchema,
  newMasterVersionSchema,
  newVariantVersionSchema,
  type ForkVariantInput,
  type NewMasterInput,
  type NewMasterVersionInput,
  type NewVariantVersionInput,
} from '@/lib/validators/document'
import { createClient } from '@/lib/supabase/server'

export type DocumentActionResult =
  | { ok: true; id: string; wordsChanged?: number }
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

// The trigger fn_ledger_on_version_insert raises with this prefix when the
// student has insufficient quota. Strip the prefix so the user sees only the
// localized guidance.
const INSUFFICIENT_QUOTA_PREFIX = 'INSUFFICIENT_WORD_QUOTA:'

function formatRpcError(prefix: string, message: string): string {
  const idx = message.indexOf(INSUFFICIENT_QUOTA_PREFIX)
  if (idx >= 0) {
    return message.slice(idx + INSUFFICIENT_QUOTA_PREFIX.length).trim()
  }
  return `${prefix}${message}`
}

export async function createDocumentMaster(input: NewMasterInput): Promise<DocumentActionResult> {
  const parsed = newMasterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'create_documents_master' as never,
    {
      p_student_id: parsed.data.student_id,
      p_doc_type: parsed.data.doc_type,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: `建立失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  return { ok: true, id: data as unknown as string }
}

export async function createMasterVersion(
  studentId: string,
  input: NewMasterVersionInput,
): Promise<DocumentActionResult> {
  const parsed = newMasterVersionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()

  // Fetch the previous version's content for diff calculation. If there's
  // no prior version, we treat the prev as empty string — the first version
  // gets billed for its full content.
  const { data: master, error: masterErr } = await supabase
    .from('documents_master')
    .select('current_version_id')
    .eq('id', parsed.data.master_id)
    .maybeSingle()

  if (masterErr) return { ok: false, error: masterErr.message }
  if (!master) return { ok: false, error: '找不到 Master' }

  let prevContent = ''
  if (master.current_version_id) {
    const { data: prev } = await supabase
      .from('documents_master_versions')
      .select('content')
      .eq('id', master.current_version_id)
      .maybeSingle()
    prevContent = (prev?.content ?? '') as string
  }

  const diff = calculateWordDiff(prevContent, parsed.data.content)

  const { data, error } = await supabase.rpc(
    'create_documents_master_version' as never,
    {
      p_master_id: parsed.data.master_id,
      p_content: parsed.data.content,
      p_word_count: diff.currentCount,
      p_word_diff_from_previous: diff.wordsChanged,
      p_change_note: parsed.data.change_note ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: formatRpcError('儲存失敗:', (error as { message: string }).message) }
  }

  revalidatePath(`/students/${studentId}`)
  revalidatePath(`/students/${studentId}/documents/${parsed.data.master_id}`)
  return { ok: true, id: data as unknown as string, wordsChanged: diff.wordsChanged }
}

export async function forkVariant(
  studentId: string,
  input: ForkVariantInput,
): Promise<DocumentActionResult> {
  const parsed = forkVariantSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'fork_documents_variant' as never,
    {
      p_master_id: parsed.data.master_id,
      p_application_id: parsed.data.application_id,
      p_source_master_version_id: parsed.data.source_master_version_id,
    } as never,
  )

  if (error) {
    return { ok: false, error: `Fork 失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}/documents/${parsed.data.master_id}`)
  return { ok: true, id: data as unknown as string }
}

export async function createVariantVersion(
  studentId: string,
  masterId: string,
  input: NewVariantVersionInput,
): Promise<DocumentActionResult> {
  const parsed = newVariantVersionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()

  // Fetch previous variant version content for diff
  const { data: variant, error: vErr } = await supabase
    .from('documents_variants')
    .select('current_version_id')
    .eq('id', parsed.data.variant_id)
    .maybeSingle()
  if (vErr) return { ok: false, error: vErr.message }
  if (!variant) return { ok: false, error: '找不到 Variant' }

  let prevContent = ''
  if (variant.current_version_id) {
    const { data: prev } = await supabase
      .from('documents_variant_versions')
      .select('content')
      .eq('id', variant.current_version_id)
      .maybeSingle()
    prevContent = (prev?.content ?? '') as string
  }

  const diff = calculateWordDiff(prevContent, parsed.data.content)

  const { data, error } = await supabase.rpc(
    'create_documents_variant_version' as never,
    {
      p_variant_id: parsed.data.variant_id,
      p_content: parsed.data.content,
      p_word_count: diff.currentCount,
      p_word_diff_from_previous: diff.wordsChanged,
      p_change_note: parsed.data.change_note ?? null,
    } as never,
  )

  if (error) {
    return { ok: false, error: formatRpcError('儲存失敗:', (error as { message: string }).message) }
  }

  revalidatePath(`/students/${studentId}`)
  revalidatePath(`/students/${studentId}/documents/${masterId}/variants/${parsed.data.variant_id}`)
  return { ok: true, id: data as unknown as string, wordsChanged: diff.wordsChanged }
}
