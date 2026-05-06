'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

const BUCKET = 'student-defer-agreements'

export type DeferActionResult = { ok: true; id: string } | { ok: false; error: string }
export type DeferUrlResult = { ok: true; url: string } | { ok: false; error: string }

export async function createDefer(
  studentId: string,
  formData: FormData,
): Promise<DeferActionResult> {
  if (!studentId) return { ok: false, error: '缺少學生 id' }

  const newDate = (formData.get('new_enrollment_date') as string | null)?.trim() ?? ''
  const oldDate = (formData.get('original_enrollment_date') as string | null)?.trim() ?? ''
  const reason = (formData.get('reason') as string | null)?.trim() ?? ''
  const file = formData.get('file')

  if (!newDate) return { ok: false, error: '新入學日期必填' }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '同意書必填' }
  }
  if (file.type !== 'application/pdf') {
    return { ok: false, error: '同意書必須是 PDF 格式' }
  }

  const supabase = createClient()

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${studentId}/defer-${ts}.pdf`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upErr) {
    return { ok: false, error: `上傳同意書失敗:${upErr.message}` }
  }

  const { data, error } = await supabase.rpc(
    'create_student_defer' as never,
    {
      p_student_id: studentId,
      p_original_enrollment_date: oldDate || null,
      p_new_enrollment_date: newDate,
      p_reason: reason || null,
      p_agreement_file_path: path,
    } as never,
  )
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: `Defer 失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: data as unknown as string }
}

export async function getDeferAgreementSignedUrl(path: string): Promise<DeferUrlResult> {
  if (!path) return { ok: false, error: '缺少檔案路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}
