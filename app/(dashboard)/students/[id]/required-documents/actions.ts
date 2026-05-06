'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

const BUCKET = 'student-required-documents'

export type SrdActionResult = { ok: true } | { ok: false; error: string }
export type SrdSignedUrlResult = { ok: true; url: string } | { ok: false; error: string }

export async function toggleRequired(
  studentId: string,
  templateId: string,
  isRequired: boolean,
): Promise<SrdActionResult> {
  const supabase = createClient()
  const { error } = await supabase.rpc(
    'toggle_required_document' as never,
    {
      p_student_id: studentId,
      p_template_id: templateId,
      p_is_required: isRequired,
    } as never,
  )
  if (error) return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

function safeFilename(code: string, original: string): string {
  const ext = original.toLowerCase().match(/\.(pdf|png|jpg|jpeg|webp)$/)?.[0] ?? '.pdf'
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `${code}-${ts}${ext}`
}

export async function uploadRequiredDocument(
  studentId: string,
  formData: FormData,
): Promise<SrdActionResult> {
  const templateId = formData.get('template_id')
  const code = formData.get('code')
  const file = formData.get('file')
  if (typeof templateId !== 'string' || !templateId) return { ok: false, error: '缺少範本 id' }
  if (typeof code !== 'string' || !code) return { ok: false, error: '缺少範本代號' }
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: '請選擇檔案' }

  const supabase = createClient()
  const path = `${studentId}/${safeFilename(code, file.name)}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { ok: false, error: `上傳失敗:${upErr.message}` }

  const { error } = await supabase.rpc(
    'set_required_document_file' as never,
    {
      p_student_id: studentId,
      p_template_id: templateId,
      p_file_path: path,
    } as never,
  )
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function clearRequiredDocument(
  studentId: string,
  templateId: string,
): Promise<SrdActionResult> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('student_required_documents' as never)
    .select('file_path')
    .eq('student_id' as never, studentId as never)
    .eq('document_template_id' as never, templateId as never)
    .maybeSingle()
  const oldPath = (row as { file_path?: string | null } | null)?.file_path ?? null

  const { error } = await supabase.rpc(
    'set_required_document_file' as never,
    { p_student_id: studentId, p_template_id: templateId, p_file_path: null } as never,
  )
  if (error) return { ok: false, error: `清除失敗:${(error as { message: string }).message}` }
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function setRequiredStatus(
  studentId: string,
  recordId: string,
  status: 'pending' | 'uploaded' | 'verified' | 'rejected',
  notes?: string,
): Promise<SrdActionResult> {
  const supabase = createClient()
  const { error } = await supabase.rpc(
    'set_required_document_status' as never,
    { p_id: recordId, p_status: status, p_notes: notes ?? null } as never,
  )
  if (error) return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function getRequiredDocSignedUrl(path: string): Promise<SrdSignedUrlResult> {
  if (!path) return { ok: false, error: '缺少檔案路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}
