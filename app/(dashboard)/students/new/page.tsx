import { redirect } from 'next/navigation'

import { StudentForm } from '@/components/students/student-form'
import type { UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

import { createStudent } from '../actions'

export const metadata = { title: '新增學生 — 留學代辦 CRM' }

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
    .select('id, full_name, display_name')
    .eq('is_active', true)
    .order('full_name')

  const consultantOptions = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.full_name,
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
        onSubmit={createStudent}
      />
    </div>
  )
}
