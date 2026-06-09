import { cookies } from 'next/headers'

import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/types/database'

// Next 15:`cookies()` 改為非同步,故 createClient 一併改為 async。
// 所有 server-side 呼叫端需 `await createClient()`(browser client
// `lib/supabase/client.ts` 不受影響,維持同步)。
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    },
  )
}
