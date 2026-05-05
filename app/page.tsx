import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">留學代辦 CRM</h1>
      <p className="mt-2 text-sm text-muted-foreground">已登入 — {user.email}</p>
      <form action="/logout" method="post" className="mt-6">
        <Button type="submit" variant="outline">
          登出
        </Button>
      </form>
    </div>
  )
}
