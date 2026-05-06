import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { ChangePasswordForm } from './change-password-form'

export const metadata = { title: '帳號安全 — 留學代辦 CRM' }

export default async function AccountSecurityPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-xl space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">帳號安全</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </header>
      <ChangePasswordForm />
    </div>
  )
}
