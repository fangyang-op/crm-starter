import { type NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  // 公開路由(無正常 session 也能存取):
  //   - 登入 / 登出
  //   - /reset-password:忘記密碼流程,訪客此時只有 recovery session(或根本沒有),
  //     不能被踢回 /login,否則永遠進不來。
  //   - /auth/*:recovery / confirm 連結的 route handler(exchangeCodeForSession /
  //     verifyOtp),在 session 建立「之前」就會被命中,必須公開。
  const isPublic =
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/logout' ||
    path === '/reset-password' ||
    path.startsWith('/auth/')

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
