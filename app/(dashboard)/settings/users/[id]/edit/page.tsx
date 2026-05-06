import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isAdmin, ROLE_LABELS, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

import { ResetPasswordCard } from './reset-password-card'

export const metadata = { title: '編輯用戶 — 留學代辦 CRM' }

export default async function UserEditPage({ params }: { params: { id: string } }) {
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

  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, role')
    .eq('id', params.id)
    .maybeSingle()
  if (!target) notFound()

  const isSelf = target.id === user.id

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
        <h1 className="text-2xl font-semibold">{target.display_name || target.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ROLE_LABELS[target.role as UserRole] ?? target.role}
          {isSelf ? ' · 這是你自己的帳號' : ''}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <span className="text-muted-foreground">中文姓名</span>
          <span>{target.full_name}</span>
          <span className="text-muted-foreground">顯示名稱</span>
          <span>{target.display_name ?? '—'}</span>
          <span className="text-muted-foreground">角色</span>
          <span>{ROLE_LABELS[target.role as UserRole] ?? target.role}</span>
        </CardContent>
      </Card>

      <ResetPasswordCard
        targetUserId={target.id}
        targetName={target.display_name || target.full_name}
        isSelf={isSelf}
      />
    </div>
  )
}
