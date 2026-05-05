'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type LoginState = {
  error?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: '請輸入 email 與密碼' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: `登入失敗:${error.message}` }
  }

  redirect('/')
}
