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

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
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
