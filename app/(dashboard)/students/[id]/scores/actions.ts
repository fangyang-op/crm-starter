'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { sniffUploadedFile } from '@/lib/utils/file-validation'
import { scoreFormSchema, type ScoreFormInput } from '@/lib/validators/score'

const BUCKET = 'student-certificates'

export type ScoreActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export type ScoreSimpleResult = { ok: true } | { ok: false; error: string }

export type SignedUrlResult = { ok: true; url: string } | { ok: false; error: string }

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

function rpcArgs(input: ScoreFormInput, certPath: string | null) {
  return {
    p_score_type: input.score_type,
    p_total_score: input.total_score,
    p_sub_scores: input.sub_scores,
    p_test_date: input.test_date ?? null,
    p_expiry_date: input.expiry_date ?? null,
    p_certificate_storage_path: certPath,
    p_is_official: input.is_official,
    p_notes: input.notes,
  }
}

function safeFilename(name: string): string {
  // Strip directory components and characters Supabase storage doesn't like
  // in path segments. Keep the extension.
  const base = name.split(/[\\/]/).pop() ?? 'file'
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'file'
}

/**
 * Upload a certificate file to {student_id}/{score_id}/{safe_filename}.
 * Caller is responsible for the score row already existing.
 * Returns the storage path on success.
 */
async function uploadCertificate(
  supabase: ReturnType<typeof createClient>,
  studentId: string,
  scoreId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  // 內容嗅探(最終權威)。證書允許 PDF / PNG / JPEG / WebP(對齊 UI accept)。
  const sniff = await sniffUploadedFile(file, {
    allowed: ['pdf', 'png', 'jpeg', 'webp'],
    maxBytes: 10 * 1024 * 1024,
  })
  if (!sniff.ok) return { ok: false, error: sniff.error }
  const path = `${studentId}/${scoreId}/${safeFilename(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: sniff.mime,
    upsert: true,
  })
  if (error) return { ok: false, error: `上傳證書失敗:${error.message}` }
  return { ok: true, path }
}

async function removeCertificate(
  supabase: ReturnType<typeof createClient>,
  path: string,
): Promise<void> {
  // Best-effort — if the file's already gone, the row deletion still wins.
  await supabase.storage.from(BUCKET).remove([path])
}

export async function createScore(formData: FormData): Promise<ScoreActionResult> {
  const raw = {
    student_id: formData.get('student_id'),
    score_type: formData.get('score_type'),
    total_score: formData.get('total_score'),
    sub_scores: parseSubScores(formData.get('sub_scores')),
    test_date: formData.get('test_date'),
    expiry_date: formData.get('expiry_date'),
    is_official: formData.get('is_official') === 'true',
    notes: formData.get('notes'),
  }
  const parsed = scoreFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()

  // Phase 1: insert the score row WITHOUT the cert path.
  const { data, error } = await supabase.rpc(
    'create_academic_score' as never,
    {
      p_student_id: parsed.data.student_id,
      ...rpcArgs(parsed.data, null),
    } as never,
  )
  if (error) {
    return { ok: false, error: `新增失敗:${(error as { message: string }).message}` }
  }
  const scoreId = data as unknown as string

  // Phase 2: if a file is attached, upload then patch the path back.
  const file = formData.get('certificate')
  if (file instanceof File && file.size > 0) {
    const up = await uploadCertificate(supabase, parsed.data.student_id, scoreId, file)
    if (!up.ok) {
      // Roll back the row so we don't leak orphans.
      await supabase.rpc('delete_academic_score' as never, { p_id: scoreId } as never)
      return { ok: false, error: up.error }
    }
    const { error: updErr } = await supabase.rpc(
      'update_academic_score' as never,
      { p_id: scoreId, ...rpcArgs(parsed.data, up.path) } as never,
    )
    if (updErr) {
      await removeCertificate(supabase, up.path)
      await supabase.rpc('delete_academic_score' as never, { p_id: scoreId } as never)
      return { ok: false, error: `更新證書路徑失敗:${(updErr as { message: string }).message}` }
    }
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  return { ok: true, id: scoreId }
}

export async function updateScore(formData: FormData): Promise<ScoreActionResult> {
  const scoreId = formData.get('score_id')
  if (typeof scoreId !== 'string' || !scoreId) {
    return { ok: false, error: '缺少 score id' }
  }

  const raw = {
    score_id: scoreId,
    student_id: formData.get('student_id'),
    score_type: formData.get('score_type'),
    total_score: formData.get('total_score'),
    sub_scores: parseSubScores(formData.get('sub_scores')),
    test_date: formData.get('test_date'),
    expiry_date: formData.get('expiry_date'),
    is_official: formData.get('is_official') === 'true',
    notes: formData.get('notes'),
  }
  const parsed = scoreFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()

  // We need the existing path so we can:
  //   (a) keep it if the user didn't change the file,
  //   (b) remove it from storage if the user replaced or removed it.
  const { data: existing, error: fetchErr } = await supabase
    .from('academic_scores')
    .select('certificate_storage_path')
    .eq('id', scoreId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: `讀取失敗:${fetchErr.message}` }
  if (!existing) return { ok: false, error: '成績不存在或無權限' }
  const oldPath = existing.certificate_storage_path as string | null

  const file = formData.get('certificate')
  const removeCert = formData.get('remove_certificate') === 'true'

  let newPath: string | null = oldPath
  if (file instanceof File && file.size > 0) {
    const up = await uploadCertificate(supabase, parsed.data.student_id, scoreId, file)
    if (!up.ok) return { ok: false, error: up.error }
    newPath = up.path
  } else if (removeCert) {
    newPath = null
  }

  const { error: updErr } = await supabase.rpc(
    'update_academic_score' as never,
    { p_id: scoreId, ...rpcArgs(parsed.data, newPath) } as never,
  )
  if (updErr) {
    // Best-effort rollback of any newly uploaded file.
    if (newPath && newPath !== oldPath) {
      await removeCertificate(supabase, newPath)
    }
    return { ok: false, error: `更新失敗:${(updErr as { message: string }).message}` }
  }

  // Old file becomes garbage if it was replaced or removed.
  if (oldPath && oldPath !== newPath) {
    await removeCertificate(supabase, oldPath)
  }

  revalidatePath(`/students/${parsed.data.student_id}`)
  return { ok: true, id: scoreId }
}

export async function deleteScore(studentId: string, scoreId: string): Promise<ScoreSimpleResult> {
  if (!scoreId) return { ok: false, error: '缺少 score id' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'delete_academic_score' as never,
    { p_id: scoreId } as never,
  )
  if (error) {
    return { ok: false, error: `刪除失敗:${(error as { message: string }).message}` }
  }

  const path = data as unknown as string | null
  if (path) {
    await removeCertificate(supabase, path)
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function getCertificateSignedUrl(path: string): Promise<SignedUrlResult> {
  if (!path) return { ok: false, error: '缺少證書路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}

function parseSubScores(value: FormDataEntryValue | null): Record<string, string | number | null> {
  if (typeof value !== 'string' || value.length === 0) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string | number | null>
    }
  } catch {
    // fall through
  }
  return {}
}
