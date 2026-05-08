'use server'

import { createClient } from '@/lib/supabase/server'

export type LoginState = { ok: true } | { ok: false; error: string }

/** 客戶端控制動畫 → 不再 server-side redirect。成功時回 { ok: true },
 *  client 收到後播 Face ID 風格動畫,動畫結束才 router.push('/'). */
export async function login(formData: FormData): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { ok: false, error: '請輸入 email 與密碼' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { ok: false, error: `登入失敗:${error.message}` }
  }

  return { ok: true }
}
