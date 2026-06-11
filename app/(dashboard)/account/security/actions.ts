'use server'

import { createClient } from '@/lib/supabase/server'
import { changeOwnPasswordSchema, type ChangeOwnPasswordInput } from '@/lib/validators/auth'

export type AccountSecurityResult =
  | { ok: true }
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

export async function changeOwnPassword(
  input: ChangeOwnPasswordInput,
): Promise<AccountSecurityResult> {
  const parsed = changeOwnPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user || !user.email) {
    return { ok: false, error: '未登入或找不到帳戶' }
  }

  // Verify the current password by re-attempting sign-in. Supabase doesn't
  // expose a "verify password" RPC; this is the documented workaround.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  })
  if (signInErr) {
    return {
      ok: false,
      error: '目前密碼不正確',
      fieldErrors: { current_password: ['目前密碼不正確'] },
    }
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  })
  if (updateErr) {
    return { ok: false, error: `更新失敗:${updateErr.message}` }
  }

  return { ok: true }
}
