'use server'

import { revalidatePath } from 'next/cache'

import { decrypt, encrypt } from '@/lib/crypto'
import { createClient } from '@/lib/supabase/server'
import {
  applicationMetaSchema,
  applicationPortalSchema,
  applicationStatusSchema,
  type ApplicationMetaInput,
  type ApplicationPortalInput,
  type ApplicationStatusInput,
} from '@/lib/validators/application'
import {
  commissionUpdateSchema,
  tuitionSchema,
  type CommissionUpdateInput,
  type TuitionInput,
} from '@/lib/validators/commission'

export type ApplicationActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export type RevealPasswordResult = { ok: true; password: string } | { ok: false; error: string }

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

export async function updateApplicationStatus(
  studentId: string,
  input: ApplicationStatusInput,
): Promise<ApplicationActionResult> {
  const parsed = applicationStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_application_status' as never,
    {
      p_id: parsed.data.application_id,
      p_status: parsed.data.status,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新狀態失敗:${(error as { message: string }).message}` }
  }

  // Auto-flip the student's status to 入學準備 (code='pre_departure') when an
  // application moves to 確定入學 (status='enrolled'). Best-effort, same
  // pattern as deals/actions.ts → maybeAutoCloseStudentStatus: a noisy failure
  // here would make the user think the application status update itself
  // failed, when it didn't. The SD function rejects no-ops, so calling it
  // when the student is already pre_departure is harmless.
  if (parsed.data.status === 'enrolled') {
    await maybeAutoMoveStudentToPreDeparture(studentId)
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

async function maybeAutoMoveStudentToPreDeparture(studentId: string): Promise<void> {
  const supabase = createClient()

  const { data: student } = await supabase
    .from('students')
    .select('status_id')
    .eq('id', studentId)
    .maybeSingle()
  const currentStatusId = (student as { status_id?: string | null } | null)?.status_id ?? null
  if (!currentStatusId) return

  const { data: preDeparture } = await supabase
    .from('student_statuses' as never)
    .select('id')
    .eq('code' as never, 'pre_departure' as never)
    .maybeSingle()
  const preDepartureId = (preDeparture as { id?: string } | null)?.id ?? null
  if (!preDepartureId || preDepartureId === currentStatusId) return

  await supabase.rpc(
    'change_student_status' as never,
    {
      p_id: studentId,
      p_new_status_id: preDepartureId,
      p_note: '申請學校確定入學後自動設定',
    } as never,
  )
}

export async function updateApplicationMeta(
  studentId: string,
  input: ApplicationMetaInput,
): Promise<ApplicationActionResult> {
  const parsed = applicationMetaSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_application_meta' as never,
    {
      p_id: parsed.data.application_id,
      p_application_round: parsed.data.application_round,
      p_deadline: parsed.data.deadline ?? null,
      p_application_fee: parsed.data.application_fee ?? null,
      p_application_fee_paid: parsed.data.application_fee_paid,
      p_notes: parsed.data.notes,
      p_decision_notes: parsed.data.decision_notes,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function updateApplicationPortal(
  studentId: string,
  input: ApplicationPortalInput,
): Promise<ApplicationActionResult> {
  const parsed = applicationPortalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  // Encrypt only when set_password is true. NULL/empty = clearing.
  let encrypted: string | null = null
  if (parsed.data.set_password) {
    const plain = parsed.data.portal_password
    if (plain && plain.length > 0) {
      encrypted = encrypt(plain)
    } else {
      encrypted = null
    }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_application_portal' as never,
    {
      p_id: parsed.data.application_id,
      p_portal_url: parsed.data.portal_url,
      p_portal_username: parsed.data.portal_username,
      p_portal_password_encrypted: encrypted,
      p_set_password: parsed.data.set_password,
      p_portal_notes: parsed.data.portal_notes,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function revealApplicationPortalPassword(
  applicationId: string,
): Promise<RevealPasswordResult> {
  if (!applicationId) return { ok: false, error: '缺少申請 id' }

  const supabase = createClient()
  // RLS gates this select — only manager+/admin or the student's consultants
  // can read this row.
  const { data, error } = await supabase
    .from('applications')
    .select('portal_password_encrypted')
    .eq('id', applicationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: `讀取失敗:${error.message}` }
  }
  if (!data) {
    return { ok: false, error: '無權限或申請不存在' }
  }
  if (!data.portal_password_encrypted) {
    return { ok: false, error: '此申請尚未設定密碼' }
  }

  try {
    const plain = decrypt(data.portal_password_encrypted)
    return { ok: true, password: plain }
  } catch (e) {
    return { ok: false, error: `解密失敗:${(e as Error).message}` }
  }
}

export async function updateTuition(
  studentId: string,
  input: TuitionInput,
): Promise<ApplicationActionResult> {
  const parsed = tuitionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_application_tuition' as never,
    {
      p_application_id: parsed.data.application_id,
      p_tuition_amount: parsed.data.tuition_amount,
      p_tuition_currency: parsed.data.tuition_currency,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新學費失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function updateCommission(
  studentId: string,
  input: CommissionUpdateInput,
): Promise<ApplicationActionResult> {
  const parsed = commissionUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc(
    'update_commission' as never,
    {
      p_id: parsed.data.commission_id,
      p_actual_amount: parsed.data.actual_amount,
      p_status: parsed.data.status,
      p_invoiced_at: parsed.data.invoiced_at ?? null,
      p_received_at: parsed.data.received_at ?? null,
      p_notes: parsed.data.notes,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新佣金失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

// ============================================================================
// 5.1 — Decision file upload (offer letter / rejection letter)
// ============================================================================
const DECISION_BUCKET = 'application-decisions'
const SCHOLARSHIP_BUCKET = 'application-scholarships'

function safePdfName(kind: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `${kind}-${ts}.pdf`
}

async function uploadPdf(
  bucket: string,
  studentId: string,
  applicationId: string,
  file: File,
  kind: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.type !== 'application/pdf') {
    return { ok: false, error: '檔案必須是 PDF 格式' }
  }
  const supabase = createClient()
  const path = `${studentId}/${applicationId}/${safePdfName(kind)}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) return { ok: false, error: `上傳失敗:${error.message}` }
  return { ok: true, path }
}

async function removeFile(bucket: string, path: string): Promise<void> {
  if (!path) return
  const supabase = createClient()
  await supabase.storage.from(bucket).remove([path])
}

export async function uploadDecisionFile(
  studentId: string,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const applicationId = formData.get('application_id')
  const kind = formData.get('kind')
  const file = formData.get('file')
  if (typeof applicationId !== 'string' || !applicationId) {
    return { ok: false, error: '缺少申請 id' }
  }
  if (kind !== 'offer' && kind !== 'rejection') {
    return { ok: false, error: '無效的檔案類型' }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '請選擇檔案' }
  }

  const supabase = createClient()
  const { data: app } = await supabase
    .from('applications')
    .select('offer_letter_path, rejection_letter_path')
    .eq('id', applicationId)
    .maybeSingle()
  const oldPath =
    kind === 'offer'
      ? ((app as { offer_letter_path?: string | null } | null)?.offer_letter_path ?? null)
      : ((app as { rejection_letter_path?: string | null } | null)?.rejection_letter_path ?? null)

  const up = await uploadPdf(DECISION_BUCKET, studentId, applicationId, file, kind)
  if (!up.ok) return up

  const { error } = await supabase.rpc(
    'set_application_decision_file' as never,
    { p_application_id: applicationId, p_kind: kind, p_path: up.path } as never,
  )
  if (error) {
    await removeFile(DECISION_BUCKET, up.path)
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  if (oldPath && oldPath !== up.path) {
    await removeFile(DECISION_BUCKET, oldPath)
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function clearDecisionFile(
  studentId: string,
  applicationId: string,
  kind: 'offer' | 'rejection',
): Promise<ApplicationActionResult> {
  if (!applicationId) return { ok: false, error: '缺少申請 id' }
  const supabase = createClient()
  const { data: app } = await supabase
    .from('applications')
    .select('offer_letter_path, rejection_letter_path')
    .eq('id', applicationId)
    .maybeSingle()
  const oldPath =
    kind === 'offer'
      ? ((app as { offer_letter_path?: string | null } | null)?.offer_letter_path ?? null)
      : ((app as { rejection_letter_path?: string | null } | null)?.rejection_letter_path ?? null)

  const { error } = await supabase.rpc(
    'set_application_decision_file' as never,
    { p_application_id: applicationId, p_kind: kind, p_path: null } as never,
  )
  if (error) {
    return { ok: false, error: `清除失敗:${(error as { message: string }).message}` }
  }
  if (oldPath) await removeFile(DECISION_BUCKET, oldPath)
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export type DecisionUrlResult = { ok: true; url: string } | { ok: false; error: string }

export async function getDecisionFileSignedUrl(path: string): Promise<DecisionUrlResult> {
  if (!path) return { ok: false, error: '缺少檔案路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(DECISION_BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}

// ============================================================================
// 5.2 — Scholarship upsert + file upload
// ============================================================================
export async function upsertScholarship(
  studentId: string,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const applicationId = formData.get('application_id')
  if (typeof applicationId !== 'string' || !applicationId) {
    return { ok: false, error: '缺少申請 id' }
  }
  const has = formData.get('has_scholarship') === 'true'
  const amountRaw = (formData.get('amount_twd') as string | null)?.trim() ?? ''
  const amount = amountRaw === '' ? null : Number(amountRaw)
  if (amountRaw && (!Number.isFinite(amount) || (amount as number) < 0)) {
    return { ok: false, error: '獎學金金額必須是非負整數' }
  }
  const name = ((formData.get('scholarship_name') as string | null) ?? '').trim() || null
  const notes = ((formData.get('notes') as string | null) ?? '').trim() || null
  const file = formData.get('file')
  const removeAward = formData.get('remove_award') === 'true'

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('application_scholarships' as never)
    .select('award_letter_path')
    .eq('application_id' as never, applicationId as never)
    .maybeSingle()
  const oldAwardPath =
    (existing as { award_letter_path?: string | null } | null)?.award_letter_path ?? null

  let awardPath: string | null = oldAwardPath
  if (file instanceof File && file.size > 0) {
    const up = await uploadPdf(SCHOLARSHIP_BUCKET, studentId, applicationId, file, 'award')
    if (!up.ok) return up
    awardPath = up.path
  } else if (removeAward) {
    awardPath = null
  }

  const { error } = await supabase.rpc(
    'upsert_application_scholarship' as never,
    {
      p_application_id: applicationId,
      p_has_scholarship: has,
      p_amount_twd: amount,
      p_scholarship_name: name,
      p_award_letter_path: awardPath,
      p_notes: notes,
    } as never,
  )
  if (error) {
    if (awardPath && awardPath !== oldAwardPath) {
      await removeFile(SCHOLARSHIP_BUCKET, awardPath)
    }
    return { ok: false, error: `儲存失敗:${(error as { message: string }).message}` }
  }
  if (oldAwardPath && oldAwardPath !== awardPath) {
    await removeFile(SCHOLARSHIP_BUCKET, oldAwardPath)
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function getScholarshipFileSignedUrl(path: string): Promise<DecisionUrlResult> {
  if (!path) return { ok: false, error: '缺少檔案路徑' }
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(SCHOLARSHIP_BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? '無法取得下載連結' }
  }
  return { ok: true, url: data.signedUrl }
}
