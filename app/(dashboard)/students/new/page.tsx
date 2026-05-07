import { redirect } from 'next/navigation'

import { StudentForm } from '@/components/students/student-form'
import type { UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

import { createStudent } from '../actions'

export const metadata = { title: '新增學生 — 放洋全端 CRM 平台' }

export default async function NewStudentPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, department')
    .eq('is_active', true)
    .order('full_name')

  const consultantOptions = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.full_name,
  }))

  // Frontend / backend 顧問 dropdowns are filtered by department.
  // Admins / 營運 / 未指定部門 won't appear in either — set their department
  // to make them assignable.
  const frontendConsultantOptions = (profiles ?? [])
    .filter((p) => p.department === 'frontend')
    .map((p) => ({ id: p.id, name: p.display_name || p.full_name }))
  const backendConsultantOptions = (profiles ?? [])
    .filter((p) => p.department === 'backend')
    .map((p) => ({ id: p.id, name: p.display_name || p.full_name }))

  const { data: referrers } = await supabase
    .from('referrers')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name')

  const referrerOptions = (referrers ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
  }))

  const { data: leadSources } = await supabase
    .from('lead_sources' as never)
    .select('id, code, label_zh, detail_field, default_referrer_id')
    .eq('is_active' as never, true as never)
    .order('sort_order' as never, { ascending: true })

  const leadSourceOptions = (
    (leadSources ?? []) as unknown as Array<{
      id: string
      code: string
      label_zh: string
      detail_field: 'none' | 'internal_user' | 'referrer'
      default_referrer_id: string | null
    }>
  ).map((l) => ({
    id: l.id,
    code: l.code,
    label_zh: l.label_zh,
    detail_field: l.detail_field,
    default_referrer_id: l.default_referrer_id,
  }))

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">新增學生</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          填寫基本資料後即可建立。狀態預設為「新名單」。
        </p>
      </header>
      <StudentForm
        mode="create"
        currentUserId={user.id}
        currentUserRole={me.role as UserRole}
        consultantOptions={consultantOptions}
        frontendConsultantOptions={frontendConsultantOptions}
        backendConsultantOptions={backendConsultantOptions}
        referrerOptions={referrerOptions}
        leadSourceOptions={leadSourceOptions}
        onSubmit={createStudent}
      />
    </div>
  )
}
