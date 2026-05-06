'use server'

import { revalidatePath } from 'next/cache'

import { calculateWordDiff } from '@/lib/word-diff'
import {
  newMasterSchema,
  newMasterVersionSchema,
  type NewMasterInput,
  type NewMasterVersionInput,
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
    return { ok: false, error: `儲存失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  revalidatePath(`/students/${studentId}/documents/${parsed.data.master_id}`)
  return { ok: true, id: data as unknown as string, wordsChanged: diff.wordsChanged }
}
