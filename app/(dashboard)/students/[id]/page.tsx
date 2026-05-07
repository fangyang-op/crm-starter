import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft, Pencil } from 'lucide-react'

import { CredentialsCard, type CredentialItem } from '@/components/students/credentials-card'
import { DeferCard, type DeferRecord } from '@/components/students/defer-card'
import { DeleteStudentDialog } from '@/components/students/delete-student-dialog'
import {
  RequiredDocumentsCard,
  type RequiredDocItem,
} from '@/components/students/required-documents-card'
import { StudentApplications } from '@/components/students/student-applications'
import { StudentDeals } from '@/components/students/student-deals'
import { StudentDocuments } from '@/components/students/student-documents'
import { StudentSchools } from '@/components/students/student-schools'
import { StudentScores } from '@/components/students/student-scores'
import { StudentStatusChanger } from '@/components/students/student-status-changer'
import { StudentTimeline } from '@/components/students/student-timeline'
import { WordQuotaCard } from '@/components/students/word-quota-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import type { StudentStatusRow } from '@/lib/constants/student-status'
import { createClient } from '@/lib/supabase/server'

const TARGET_DEGREE_LABELS: Record<string, string> = {
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  language: '語言學校',
  tour: '遊學團',
  other: '其他',
}

// v1.1 §2: current_degree is now stored as the Chinese label itself
// (國一/大一/在台碩士/在職人士/...). Legacy English codes are migrated to the
// closest new value (or NULL) by migration 0035, so the label map is gone.

function fmt(value: string | number | null | undefined): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }
  return <span>{value}</span>
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      </div>
    )
  }
  if (!student) notFound()

  const profileIds = [
    student.frontend_consultant_id,
    student.backend_consultant_id,
    student.lead_source_user_id,
  ].filter((v): v is string => Boolean(v))
  const { data: consultants } =
    profileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, display_name').in('id', profileIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const consultantMap = new Map(
    (consultants ?? []).map((c) => [c.id, c.display_name || c.full_name]),
  )

  const sourceReferrerName = student.lead_source_referrer_id
    ? ((
        await supabase
          .from('referrers')
          .select('name')
          .eq('id', student.lead_source_referrer_id)
          .maybeSingle()
      ).data?.name ?? null)
    : null

  const leadSourceId = (student as { lead_source_id?: string | null }).lead_source_id
  const leadSourceLabel = leadSourceId
    ? ((
        (
          await supabase
            .from('lead_sources' as never)
            .select('label_zh')
            .eq('id' as never, leadSourceId as never)
            .maybeSingle()
        ).data as unknown as { label_zh?: string } | null
      )?.label_zh ?? null)
    : null

  // Spec § 2.9: 選校表 / 文件 / 申請 tabs are locked until at least one deal
  // exists for this student. Deals don't have a soft-delete flag; any row
  // counts as "成交建立".
  const { count: dealCount } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', params.id)
  const hasDeal = (dealCount ?? 0) > 0

  // Spec § 2.10: visa/housing credential cards unlock once at least one
  // application has reached status='enrolled'.
  const { count: enrolledCount } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', params.id)
    .eq('status', 'enrolled')
  const credentialsUnlocked = (enrolledCount ?? 0) > 0

  const { data: credentialsRaw } = await supabase
    .from('student_credentials' as never)
    .select('id, credential_type, label, url, account, password_encrypted, notes')
    .eq('student_id' as never, params.id as never)
  const credentials = (
    (credentialsRaw ?? []) as unknown as Array<{
      id: string
      credential_type: 'visa' | 'housing'
      label: string
      url: string | null
      account: string | null
      password_encrypted: string | null
      notes: string | null
    }>
  ).map((c) => ({
    id: c.id,
    credential_type: c.credential_type,
    label: c.label,
    url: c.url,
    account: c.account,
    has_password: Boolean(c.password_encrypted),
    notes: c.notes,
  }))
  const visaCreds: CredentialItem[] = credentials.filter((c) => c.credential_type === 'visa')
  const housingCreds: CredentialItem[] = credentials.filter((c) => c.credential_type === 'housing')

  // Required-documents checklist (spec § 2.11): join the org-wide templates
  // table with this student's per-row state. We render every active template
  // even if no row exists yet — the row gets upserted by toggle/upload.
  const [{ data: templatesRaw }, { data: srdRaw }] = await Promise.all([
    supabase
      .from('document_templates' as never)
      .select('id, code, label_zh, category, notes, default_required, sort_order, is_active')
      .eq('is_active' as never, true as never)
      .order('sort_order' as never, { ascending: true }),
    supabase
      .from('student_required_documents' as never)
      .select('id, document_template_id, is_required, status, file_path')
      .eq('student_id' as never, params.id as never),
  ])
  const templates = (templatesRaw ?? []) as unknown as Array<{
    id: string
    code: string
    label_zh: string
    category: 'school_application' | 'visa_enrollment' | 'other'
    notes: string | null
    default_required: boolean
    sort_order: number
  }>
  const srdRows = (srdRaw ?? []) as unknown as Array<{
    id: string
    document_template_id: string
    is_required: boolean
    status: 'pending' | 'uploaded' | 'verified' | 'rejected'
    file_path: string | null
  }>
  const srdByTemplate = new Map(srdRows.map((r) => [r.document_template_id, r]))
  const requiredDocItems: RequiredDocItem[] = templates.map((t) => {
    const r = srdByTemplate.get(t.id)
    return {
      template_id: t.id,
      code: t.code,
      label_zh: t.label_zh,
      category: t.category,
      notes: t.notes,
      record_id: r?.id ?? null,
      is_required: r ? r.is_required : t.default_required,
      status: r?.status ?? 'pending',
      file_path: r?.file_path ?? null,
    }
  })

  // Defer history (latest first)
  const { data: defersRaw } = await supabase
    .from('student_defers' as never)
    .select(
      'id, original_enrollment_date, new_enrollment_date, reason, agreement_file_path, created_at',
    )
    .eq('student_id' as never, params.id as never)
    .order('created_at' as never, { ascending: false })
  const deferRecords = (defersRaw ?? []) as unknown as DeferRecord[]

  // student_statuses for the changer dialog (active only) + the current status row.
  const { data: statusesRaw } = await supabase
    .from('student_statuses' as never)
    .select('id, code, label_zh, category, color_key, sort_order, is_active')
    .order('sort_order' as never, { ascending: true })
  const allStatuses = (statusesRaw ?? []) as unknown as StudentStatusRow[]
  const studentStatusId = (student as { status_id?: string | null }).status_id ?? null
  const currentStatus =
    (studentStatusId ? allStatuses.find((s) => s.id === studentStatusId) : null) ?? null

  const role = me.role as UserRole
  const canDelete = isManagerOrAdmin(role)
  const canChangeStatus =
    isManagerOrAdmin(role) ||
    student.frontend_consultant_id === user.id ||
    student.backend_consultant_id === user.id

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div>
        <Link
          href="/students"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回列表
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{student.full_name}</h1>
            {student.english_name ? (
              <span className="text-muted-foreground">{student.english_name}</span>
            ) : null}
            {currentStatus ? (
              <StudentStatusChanger
                studentId={student.id}
                currentStatus={currentStatus}
                options={allStatuses.filter((s) => s.is_active)}
                canEdit={canChangeStatus}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            建立於{' '}
            {new Date(student.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}
            {student.frontend_consultant_id ? (
              <>
                {' · '}前端顧問 {consultantMap.get(student.frontend_consultant_id) ?? '—'}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/students/${student.id}/edit`}>
              <Pencil size={14} className="mr-1.5" />
              編輯
            </Link>
          </Button>
          {canDelete ? <DeleteStudentDialog studentId={student.id} /> : null}
        </div>
      </header>

      {currentStatus?.code === 'closed_won' &&
      !student.backend_consultant_id &&
      isManagerOrAdmin(role) ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          這位學生已成交,但尚未派遣後端顧問。請點{' '}
          <Link href={`/students/${student.id}/edit`} className="font-medium underline">
            編輯
          </Link>{' '}
          指派後端顧問。
        </div>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概覽</TabsTrigger>
          <TabsTrigger value="timeline">時間軸</TabsTrigger>
          <TabsTrigger value="scores">成績</TabsTrigger>
          <TabsTrigger value="deals">成交</TabsTrigger>
          <TabsTrigger value="schools" disabled={!hasDeal}>
            選校表 {!hasDeal ? '🔒' : ''}
          </TabsTrigger>
          <TabsTrigger value="documents" disabled={!hasDeal}>
            文件 {!hasDeal ? '🔒' : ''}
          </TabsTrigger>
          <TabsTrigger value="applications" disabled={!hasDeal}>
            申請 {!hasDeal ? '🔒' : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <WordQuotaCard
            studentId={student.id}
            studentName={student.full_name}
            canAddBonus={isManagerOrAdmin(role) || student.frontend_consultant_id === user.id}
          />

          {/* 申請準備 Checklist (左) + Defer 延後入學 (右) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RequiredDocumentsCard
              studentId={student.id}
              items={requiredDocItems}
              canEdit={canChangeStatus}
            />
            <DeferCard
              studentId={student.id}
              records={deferRecords}
              eligible={
                currentStatus?.code === 'decision_making' ||
                currentStatus?.code === 'pre_departure' ||
                currentStatus?.code === 'enrolled'
              }
              canEdit={canChangeStatus}
            />
          </div>

          {/* 入學準備 — 簽證 / 住宿帳密 (spec § 2.10), gated by enrolled */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CredentialsCard
              studentId={student.id}
              type="visa"
              title="簽證帳密"
              items={visaCreds}
              unlocked={credentialsUnlocked}
              canEdit={canChangeStatus}
            />
            <CredentialsCard
              studentId={student.id}
              type="housing"
              title="住宿帳密"
              items={housingCreds}
              unlocked={credentialsUnlocked}
              canEdit={canChangeStatus}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本資料</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">中文姓名</span>
                {fmt(student.full_name)}
                <span className="text-muted-foreground">英文姓名</span>
                {fmt(student.english_name)}
                <span className="text-muted-foreground">Email</span>
                {fmt(student.email)}
                <span className="text-muted-foreground">電話</span>
                {fmt(student.phone)}
                <span className="text-muted-foreground">LINE ID</span>
                {fmt(student.line_id)}
                <span className="text-muted-foreground">生日</span>
                {fmt(student.birth_date)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">當前學歷</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">學校</span>
                {fmt(student.current_school)}
                <span className="text-muted-foreground">科系</span>
                {fmt(student.current_major)}
                <span className="text-muted-foreground">學歷</span>
                {fmt(student.current_degree)}
                <span className="text-muted-foreground">畢業年份</span>
                {fmt(student.graduation_year)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">申請目標</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">國家</span>
                {fmt(student.target_country?.join(' / ') ?? null)}
                <span className="text-muted-foreground">學位</span>
                {fmt(
                  student.target_degree
                    ? (TARGET_DEGREE_LABELS[student.target_degree] ?? student.target_degree)
                    : null,
                )}
                <span className="text-muted-foreground">科系</span>
                {fmt(student.target_major)}
                <span className="text-muted-foreground">入學期間</span>
                {fmt(student.target_intake)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">名單來源 + 顧問</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">來源類型</span>
                {fmt(leadSourceLabel)}
                {student.lead_source_user_id ? (
                  <>
                    <span className="text-muted-foreground">來源同事</span>
                    {fmt(consultantMap.get(student.lead_source_user_id) ?? '—')}
                  </>
                ) : null}
                {student.lead_source_referrer_id ? (
                  <>
                    <span className="text-muted-foreground">轉介人</span>
                    {fmt(sourceReferrerName)}
                  </>
                ) : null}
                <span className="text-muted-foreground">來源備註</span>
                {fmt(student.lead_source_note)}
                <span className="text-muted-foreground">前端顧問</span>
                {fmt(
                  student.frontend_consultant_id
                    ? (consultantMap.get(student.frontend_consultant_id) ?? '—')
                    : null,
                )}
                <span className="text-muted-foreground">後端顧問</span>
                {fmt(
                  student.backend_consultant_id
                    ? (consultantMap.get(student.backend_consultant_id) ?? '—')
                    : null,
                )}
              </CardContent>
            </Card>

            {student.notes ? (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">備註</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm">{student.notes}</CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <StudentTimeline studentId={student.id} />
        </TabsContent>
        <TabsContent value="scores">
          <StudentScores studentId={student.id} canEdit={canChangeStatus} />
        </TabsContent>
        <TabsContent value="deals">
          <StudentDeals
            studentId={student.id}
            studentName={student.full_name}
            defaultConsultantId={student.frontend_consultant_id}
            canCreate={canChangeStatus}
            canEdit={canChangeStatus}
          />
        </TabsContent>
        <TabsContent value="schools">
          {hasDeal ? (
            <StudentSchools studentId={student.id} canEdit={canChangeStatus} />
          ) : (
            <DealGateNotice />
          )}
        </TabsContent>
        <TabsContent value="documents">
          {hasDeal ? (
            <StudentDocuments studentId={student.id} canCreate={canChangeStatus} />
          ) : (
            <DealGateNotice />
          )}
        </TabsContent>
        <TabsContent value="applications">
          {!hasDeal ? (
            <DealGateNotice />
          ) : (
            <StudentApplications
              studentId={student.id}
              canEdit={canChangeStatus}
              isManager={isManagerOrAdmin(role)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DealGateNotice() {
  return (
    <div className="rounded-md border border-dashed p-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        🔒
      </div>
      <h3 className="text-sm font-medium">尚未建立成交</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        請先到「成交」分頁建立至少一筆成交,選校表 / 文件 / 申請功能會自動解鎖。
      </p>
    </div>
  )
}
