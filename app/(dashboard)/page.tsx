import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <h1 className="text-2xl font-semibold">儀表板</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        歡迎回來,{user?.email}。Phase 5 會在這裡放 KPI 卡與待辦清單。
      </p>
    </div>
  )
}
