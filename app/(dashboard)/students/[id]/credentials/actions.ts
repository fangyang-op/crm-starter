'use server'

import { revalidatePath } from 'next/cache'

import { decrypt, encrypt } from '@/lib/crypto'
import { createClient } from '@/lib/supabase/server'

export type CredentialActionResult = { ok: true; id?: string } | { ok: false; error: string }

export type RevealCredentialResult = { ok: true; password: string } | { ok: false; error: string }

export async function createCredential(
  studentId: string,
  input: {
    credential_type: 'visa' | 'housing'
    label: string
    url?: string | null
    account?: string | null
    password?: string | null
    notes?: string | null
  },
): Promise<CredentialActionResult> {
  if (!studentId) return { ok: false, error: '缺少學生 id' }
  if (!input.label.trim()) return { ok: false, error: '請填寫名稱' }
  const supabase = await createClient()
  const encrypted = input.password && input.password.length > 0 ? encrypt(input.password) : null

  const { data, error } = await supabase.rpc(
    'create_student_credential' as never,
    {
      p_student_id: studentId,
      p_credential_type: input.credential_type,
      p_label: input.label,
      p_url: input.url ?? null,
      p_account: input.account ?? null,
      p_password_encrypted: encrypted,
      p_notes: input.notes ?? null,
    } as never,
  )
  if (error) {
    return { ok: false, error: `新增失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true, id: data as unknown as string }
}

export async function updateCredential(
  studentId: string,
  credentialId: string,
  input: {
    label: string
    url?: string | null
    account?: string | null
    /** undefined = leave alone; null = clear; string = set new */
    password?: string | null | undefined
    notes?: string | null
  },
): Promise<CredentialActionResult> {
  if (!credentialId) return { ok: false, error: '缺少 id' }
  const setPassword = input.password !== undefined
  let encrypted: string | null = null
  if (setPassword && input.password) {
    encrypted = encrypt(input.password)
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'update_student_credential' as never,
    {
      p_id: credentialId,
      p_label: input.label,
      p_url: input.url ?? null,
      p_account: input.account ?? null,
      p_password_encrypted: encrypted,
      p_set_password: setPassword,
      p_notes: input.notes ?? null,
    } as never,
  )
  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function deleteCredential(
  studentId: string,
  credentialId: string,
): Promise<CredentialActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'delete_student_credential' as never,
    { p_id: credentialId } as never,
  )
  if (error) {
    return { ok: false, error: `刪除失敗:${(error as { message: string }).message}` }
  }
  revalidatePath(`/students/${studentId}`)
  return { ok: true }
}

export async function revealCredentialPassword(
  credentialId: string,
): Promise<RevealCredentialResult> {
  if (!credentialId) return { ok: false, error: '缺少 id' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('student_credentials' as never)
    .select('password_encrypted')
    .eq('id' as never, credentialId as never)
    .maybeSingle()
  if (error) return { ok: false, error: `讀取失敗:${error.message}` }
  const enc = (data as { password_encrypted?: string | null } | null)?.password_encrypted
  if (!enc) return { ok: false, error: '尚未設定密碼' }
  try {
    return { ok: true, password: decrypt(enc) }
  } catch (e) {
    return { ok: false, error: `解密失敗:${(e as Error).message}` }
  }
}
