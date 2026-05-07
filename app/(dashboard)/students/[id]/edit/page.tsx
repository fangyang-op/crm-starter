import { notFound, redirect } from 'next/navigation'

import { StudentForm } from '@/components/students/student-form'
import type { UserRole } from '@/lib/constants/roles'
import type { StudentInput } from '@/lib/validators/student'
import { createClient } from '@/lib/supabase/server'

import { updateStudent } from '../../actions'

export const metadata = { title: '編輯學生 — 放洋全端 CRM 平台' }

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student) notFound()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, department')
    .eq('is_active', true)
    .order('full_name')

  const consultantOptions = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.full_name,
  }))

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

  const initialValues: Partial<StudentInput> = {
    full_name: student.full_name,
    english_name: student.english_name,
    email: student.email,
    phone: student.phone,
    line_id: student.line_id,
    birth_date: student.birth_date,
    current_school: student.current_school,
    current_major: student.current_major,
    current_degree: student.current_degree as StudentInput['current_degree'],
    graduation_year: student.graduation_year,
    target_country: student.target_country as StudentInput['target_country'],
    target_degree: student.target_degree as StudentInput['target_degree'],
    target_major: student.target_major,
    target_intake: student.target_intake,
    lead_source_id: (student as { lead_source_id?: string | null }).lead_source_id ?? '',
    lead_source_user_id: student.lead_source_user_id,
    lead_source_referrer_id: student.lead_source_referrer_id,
    lead_source_note: student.lead_source_note,
    frontend_consultant_id: student.frontend_consultant_id,
    backend_consultant_id: student.backend_consultant_id,
    notes: student.notes,
    tags: student.tags,
  }

  const updateThisStudent = updateStudent.bind(null, student.id)

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">編輯學生 — {student.full_name}</h1>
      </header>
      <StudentForm
        mode="edit"
        studentId={student.id}
        initialValues={initialValues}
        currentUserId={user.id}
        currentUserRole={me.role as UserRole}
        consultantOptions={consultantOptions}
        frontendConsultantOptions={frontendConsultantOptions}
        backendConsultantOptions={backendConsultantOptions}
        referrerOptions={referrerOptions}
        leadSourceOptions={leadSourceOptions}
        onSubmit={updateThisStudent}
      />
    </div>
  )
}
