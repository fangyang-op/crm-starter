import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft, Pencil } from 'lucide-react'

import { DeleteStudentDialog } from '@/components/students/delete-student-dialog'
import { StudentTimeline } from '@/components/students/student-timeline'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

const TARGET_DEGREE_LABELS: Record<string, string> = {
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  language: '語言學校',
  tour: '遊學團',
  other: '其他',
}

const CURRENT_DEGREE_LABELS: Record<string, string> = {
  high_school: '高中',
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  other: '其他',
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  self_developed: '自行開發',
  marketing_dept: '行銷部分配',
  consultant_referral: '同事轉介',
  external_referrer: '外部轉介人',
  brand_introduction: '品牌介紹',
  other: '其他',
}

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

  const consultantIds = [student.frontend_consultant_id, student.backend_consultant_id].filter(
    (v): v is string => Boolean(v),
  )
  const { data: consultants } =
    consultantIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name, display_name')
          .in('id', consultantIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const consultantMap = new Map(
    (consultants ?? []).map((c) => [c.id, c.display_name || c.full_name]),
  )

  const role = me.role as UserRole
  const canDelete = isManagerOrAdmin(role)

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
            <StatusBadge status={student.status} />
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概覽</TabsTrigger>
          <TabsTrigger value="timeline">時間軸</TabsTrigger>
          <TabsTrigger value="deals">成交</TabsTrigger>
          <TabsTrigger value="schools">選校表</TabsTrigger>
          <TabsTrigger value="documents">文件</TabsTrigger>
          <TabsTrigger value="applications">申請</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
                <span className="text-muted-foreground">學位</span>
                {fmt(
                  student.current_degree
                    ? (CURRENT_DEGREE_LABELS[student.current_degree] ?? student.current_degree)
                    : null,
                )}
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
                {fmt(LEAD_SOURCE_LABELS[student.lead_source_type] ?? student.lead_source_type)}
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
        <TabsContent value="deals">
          <PhasePlaceholder phase="1.7-1.8" hint="顯示與建立成交,含績效拆分" />
        </TabsContent>
        <TabsContent value="schools">
          <PhasePlaceholder phase="2" hint="多版本選校表,鎖定後展開為申請項目" />
        </TabsContent>
        <TabsContent value="documents">
          <PhasePlaceholder phase="3" hint="文件 Master / Variant 版本管理 + 字數帳本" />
        </TabsContent>
        <TabsContent value="applications">
          <PhasePlaceholder phase="4" hint="申請進度看板 + Portal 帳密 + 成績" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PhasePlaceholder({ phase, hint }: { phase: string; hint: string }) {
  return (
    <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
      此分頁將於 Phase {phase} 完成
      <br />
      <span className="text-xs">{hint}</span>
    </div>
  )
}
