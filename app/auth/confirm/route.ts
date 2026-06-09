import { NextResponse } from 'next/server'

import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

// /auth/confirm — 接住 Supabase 寄出的 recovery / confirm 連結,建立暫時 session
// 後把使用者送進 /reset-password(或 ?next 指定的站內路徑)。
//
// 支援 @supabase/ssr 的兩種伺服器端流程,依 Dashboard email 樣板而定:
//   1. PKCE code 流程:?code=...                       → exchangeCodeForSession
//   2. token_hash 流程:?token_hash=...&type=recovery  → verifyOtp
// 成功後 session 會寫進 cookie(server client 的 setAll),redirect 到 next 時
// /reset-password 即可讀到 recovery session。
//
// 失敗(連結帶 error 參數、或 code/token 驗證失敗)→ 一律 redirect 到
// /reset-password?error=<code>,由該頁顯示友善中文訊息,絕不掉回登入頁白畫面。

/** 只允許站內相對路徑,避免 open redirect。 */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/reset-password'
}

function fail(requestUrl: string, code: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/reset-password?error=${encodeURIComponent(code)}`, requestUrl),
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const next = safeNext(searchParams.get('next'))

  // Supabase 在驗證失敗時可能把錯誤帶在 query(也可能在 hash,hash 由前端讀)。
  const incomingError = searchParams.get('error_code') ?? searchParams.get('error')
  if (incomingError) return fail(request.url, incomingError)

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail(request.url, error.code ?? 'exchange_failed')
    return NextResponse.redirect(new URL(next, request.url))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return fail(request.url, error.code ?? 'verify_failed')
    return NextResponse.redirect(new URL(next, request.url))
  }

  // 沒有任何可用參數 → 當作無效連結。
  return fail(request.url, 'invalid_link')
}
