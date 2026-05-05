import { notFound, redirect } from 'next/navigation'

import { StudentForm } from '@/components/students/student-form'
import type { UserRole } from '@/lib/constants/roles'
import type { StudentInput } from '@/lib/validators/student'
import { createClient } from '@/lib/supabase/server'

import { updateStudent } from '../../actions'

export const metadata = { title: '編輯學生 — 留學代辦 CRM' }

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
    .select('id, full_name, display_name')
    .eq('is_active', true)
    .order('full_name')

  const consultantOptions = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.full_name,
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
    lead_source_type: student.lead_source_type,
    lead_source_user_id: student.lead_source_user_id,
    lead_source_referrer_id: student.lead_source_referrer_id,
    lead_source_note: student.lead_source_note,
    frontend_consultant_id: student.frontend_consultant_id,
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
        onSubmit={updateThisStudent}
      />
    </div>
  )
}
