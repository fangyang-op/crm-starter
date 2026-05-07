import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'

import { isAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

import { NewUserForm } from './new-user-form'

export const metadata = { title: '新增帳號 — 放洋全端 CRM 平台' }

export default async function NewUserPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || !isAdmin(me.role as UserRole)) redirect('/')

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
      <div>
        <Link
          href="/settings/users"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回用戶列表
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">新增帳號</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          建立後密碼只在這裡顯示一次,請以安全管道告知對方。
        </p>
      </header>

      <NewUserForm />
    </div>
  )
}
