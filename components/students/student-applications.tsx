import {
  ApplicationsView,
  type ApplicationRow,
} from '@/components/students/applications/applications-view'
import type { ApplicationStatus } from '@/lib/constants/application-status'
import { createClient } from '@/lib/supabase/server'

type Props = {
  studentId: string
  canEdit: boolean
  isManager: boolean
}

export async function StudentApplications({ studentId, canEdit, isManager }: Props) {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('applications')
    .select(
      'id, school_id, program_id, program_name_override, status, application_round, deadline, ' +
        'submitted_at, decision_at, decision_notes, portal_url, portal_username, ' +
        'portal_password_encrypted, portal_notes, application_fee, application_fee_paid, notes, ' +
        'tuition_amount, tuition_currency, offer_letter_path, rejection_letter_path',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })

  const apps = (rows ?? []) as unknown as Array<{
    id: string
    school_id: string
    program_id: string | null
    program_name_override: string | null
    status: string
    application_round: string | null
    deadline: string | null
    submitted_at: string | null
    decision_at: string | null
    decision_notes: string | null
    portal_url: string | null
    portal_username: string | null
    portal_password_encrypted: string | null
    portal_notes: string | null
    application_fee: number | null
    application_fee_paid: boolean | null
    notes: string | null
    tuition_amount: number | null
    tuition_currency: string | null
    offer_letter_path: string | null
    rejection_letter_path: string | null
  }>

  const schoolIds = Array.from(new Set(apps.map((a) => a.school_id)))
  const programIds = Array.from(
    new Set(apps.map((a) => a.program_id).filter((v): v is string => Boolean(v))),
  )

  const appIds = apps.map((a) => a.id)

  const [{ data: schools }, { data: programs }, { data: commissions }, { data: scholarships }] =
    await Promise.all([
      schoolIds.length > 0
        ? supabase
            .from('schools')
            .select(
              'id, name_en, name_zh, short_name, country, is_partner, partner_commission_rate',
            )
            .in('id', schoolIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              name_en: string
              name_zh: string | null
              short_name: string | null
              country: string
              is_partner: boolean
              partner_commission_rate: number | null
            }>,
          }),
      programIds.length > 0
        ? supabase
            .from('school_programs')
            .select('id, program_name, degree_level')
            .in('id', programIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; program_name: string; degree_level: string }>,
          }),
      // Commission records: only manager+/admin can SELECT (RLS), so non-managers
      // simply receive [] here — no error to swallow.
      isManager && appIds.length > 0
        ? supabase
            .from('commission_records')
            .select(
              'id, application_id, expected_amount, actual_amount, currency, status, ' +
                'invoiced_at, received_at, notes',
            )
            .in('application_id', appIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              application_id: string
              expected_amount: number | null
              actual_amount: number | null
              currency: string
              status: string
              invoiced_at: string | null
              received_at: string | null
              notes: string | null
            }>,
          }),
      appIds.length > 0
        ? supabase
            .from('application_scholarships' as never)
            .select(
              'id, application_id, has_scholarship, amount_twd, scholarship_name, award_letter_path, notes',
            )
            .in('application_id' as never, appIds as never)
        : Promise.resolve({ data: [] as unknown as never[] }),
    ])

  const schoolMap = new Map((schools ?? []).map((s) => [s.id, s]))
  const programMap = new Map((programs ?? []).map((p) => [p.id, p.program_name]))
  const scholarshipMap = new Map(
    (
      (scholarships ?? []) as unknown as Array<{
        id: string
        application_id: string
        has_scholarship: boolean
        amount_twd: number | null
        scholarship_name: string | null
        award_letter_path: string | null
        notes: string | null
      }>
    ).map((s) => [s.application_id, s]),
  )
  const commissionMap = new Map(
    (
      (commissions ?? []) as unknown as Array<{
        id: string
        application_id: string
        expected_amount: number | null
        actual_amount: number | null
        currency: string
        status: string
        invoiced_at: string | null
        received_at: string | null
        notes: string | null
      }>
    ).map((c) => [c.application_id, c]),
  )

  const list: ApplicationRow[] = apps.map((a) => {
    const sch = schoolMap.get(a.school_id)
    const com = commissionMap.get(a.id)
    return {
      id: a.id,
      school_id: a.school_id,
      school_name: sch?.short_name || sch?.name_en || '(未知學校)',
      school_country: sch?.country ?? '',
      school_is_partner: Boolean(sch?.is_partner),
      school_commission_rate: sch?.partner_commission_rate ?? null,
      program_label:
        a.program_name_override ??
        (a.program_id ? (programMap.get(a.program_id) ?? '未指定科系') : '未指定科系'),
      status: a.status as ApplicationStatus,
      application_round: a.application_round,
      deadline: a.deadline,
      submitted_at: a.submitted_at,
      decision_at: a.decision_at,
      decision_notes: a.decision_notes,
      portal_url: a.portal_url,
      portal_username: a.portal_username,
      has_portal_password: Boolean(a.portal_password_encrypted),
      portal_notes: a.portal_notes,
      application_fee: a.application_fee,
      application_fee_paid: a.application_fee_paid ?? false,
      notes: a.notes,
      tuition_amount: a.tuition_amount,
      tuition_currency: a.tuition_currency ?? 'USD',
      offer_letter_path: a.offer_letter_path,
      rejection_letter_path: a.rejection_letter_path,
      scholarship: scholarshipMap.get(a.id)
        ? {
            id: scholarshipMap.get(a.id)!.id,
            has_scholarship: scholarshipMap.get(a.id)!.has_scholarship,
            amount_twd: scholarshipMap.get(a.id)!.amount_twd,
            scholarship_name: scholarshipMap.get(a.id)!.scholarship_name,
            award_letter_path: scholarshipMap.get(a.id)!.award_letter_path,
            notes: scholarshipMap.get(a.id)!.notes,
          }
        : null,
      commission: com
        ? {
            id: com.id,
            expected_amount: com.expected_amount,
            actual_amount: com.actual_amount,
            currency: com.currency,
            status: com.status,
            invoiced_at: com.invoiced_at,
            received_at: com.received_at,
            notes: com.notes,
          }
        : null,
    }
  })

  if (list.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <h3 className="text-sm font-medium">尚無申請項目</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          鎖定一份選校表後,在「選校表」分頁點「展開為申請項」就會建立。
        </p>
      </div>
    )
  }

  return (
    <ApplicationsView
      studentId={studentId}
      applications={list}
      canEdit={canEdit}
      isManager={isManager}
    />
  )
}
