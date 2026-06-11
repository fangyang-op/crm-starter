'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { sniffUploadedFile } from '@/lib/utils/file-validation'

const BUCKET = 'student-required-documents'

export type SrdActionResult = { ok: true } | { ok: false; error: string }
export type SrdSignedUrlResult = { ok: true; url: string } | { ok: false; error: string }

export async function toggleRequired(
  studentId: string,
  templateId: string,
  isRequired: boolean,
): Promise<SrdActionResult> {
  const supabase = await createClient()
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
  // 內容嗅探(最終權威)。必備文件允許 PDF / PNG / JPEG / WebP(對齊 UI accept)。
  const sniff = await sniffUploadedFile(file, {
    allowed: ['pdf', 'png', 'jpeg', 'webp'],
    maxBytes: 10 * 1024 * 1024,
  })
  if (!sniff.ok) return { ok: false, error: sniff.error }

  const supabase = await createClient()
  const path = `${studentId}/${safeFilename(code, file.name)}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: sniff.mime,
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
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}
