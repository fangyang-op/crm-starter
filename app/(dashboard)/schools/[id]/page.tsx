import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft, ExternalLink, Pencil, Plus } from 'lucide-react'

import { ProgramFormDialog } from '@/components/schools/program-form-dialog'
import { SchoolFormDialog } from '@/components/schools/school-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { COUNTRY_LABELS, DEGREE_LEVEL_LABELS } from '@/lib/constants/school'
import { createClient } from '@/lib/supabase/server'

function fmt(value: string | number | null | undefined): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }
  return <span>{value}</span>
}

export default async function SchoolDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const canEdit = me ? isManagerOrAdmin(me.role as UserRole) : false

  const { data: school } = await supabase
    .from('schools')
    .select(
      'id, name_en, name_zh, short_name, country, state_or_region, city, website, ranking_qs, ranking_us_news, is_partner, partner_commission_rate, partner_notes, is_active',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!school) notFound()

  const { data: programs } = await supabase
    .from('school_programs')
    .select(
      'id, program_name, degree_level, major_category, application_deadline_round1, application_deadline_round2, notes',
    )
    .eq('school_id', school.id)
    .order('degree_level')
    .order('program_name')

  const country = COUNTRY_LABELS[school.country as keyof typeof COUNTRY_LABELS] ?? school.country

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div>
        <Link
          href="/schools"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回列表
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {school.short_name ? (
              <span className="text-sm text-muted-foreground">{school.short_name}</span>
            ) : null}
            <h1 className="text-2xl font-semibold">{school.name_en}</h1>
            {school.is_partner ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">合作</Badge>
            ) : null}
            {!school.is_active ? (
              <Badge variant="outline" className="text-muted-foreground">
                停用
              </Badge>
            ) : null}
          </div>
          {school.name_zh ? (
            <p className="mt-1 text-sm text-muted-foreground">{school.name_zh}</p>
          ) : null}
        </div>
        {canEdit ? (
          <SchoolFormDialog
            mode="edit"
            initial={{
              id: school.id,
              name_en: school.name_en,
              name_zh: school.name_zh,
              short_name: school.short_name,
              country: school.country as never,
              state_or_region: school.state_or_region,
              city: school.city,
              website: school.website,
              ranking_qs: school.ranking_qs,
              ranking_us_news: school.ranking_us_news,
              is_partner: school.is_partner,
              partner_commission_rate:
                school.partner_commission_rate === null
                  ? null
                  : Number(school.partner_commission_rate),
              partner_notes: school.partner_notes,
              is_active: school.is_active,
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil size={14} className="mr-1.5" />
                編輯
              </Button>
            }
          />
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            <span className="text-muted-foreground">國家</span>
            <span>{country}</span>
            <span className="text-muted-foreground">州/區</span>
            {fmt(school.state_or_region)}
            <span className="text-muted-foreground">城市</span>
            {fmt(school.city)}
            <span className="text-muted-foreground">官網</span>
            <span>
              {school.website ? (
                <a
                  href={school.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm hover:text-primary hover:underline"
                >
                  {school.website}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">排名 + 合作</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
            <span className="text-muted-foreground">QS</span>
            {fmt(school.ranking_qs)}
            <span className="text-muted-foreground">US News</span>
            {fmt(school.ranking_us_news)}
            <span className="text-muted-foreground">合作</span>
            <span>
              {school.is_partner ? (
                <span>
                  是 · 回傭率{' '}
                  {school.partner_commission_rate === null
                    ? '—'
                    : `${Number(school.partner_commission_rate)}%`}
                </span>
              ) : (
                <span className="text-muted-foreground">否</span>
              )}
            </span>
            <span className="text-muted-foreground">合作備註</span>
            {fmt(school.partner_notes)}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">科系</h2>
          {canEdit ? (
            <ProgramFormDialog
              mode="create"
              schoolId={school.id}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus size={14} className="mr-1" />
                  新增科系
                </Button>
              }
            />
          ) : null}
        </div>

        {!programs || programs.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            {canEdit ? '尚無科系。點右上「新增科系」開始。' : '尚無科系。'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>科系名稱</TableHead>
                  <TableHead>學位</TableHead>
                  <TableHead>類別</TableHead>
                  <TableHead>R1 截止</TableHead>
                  <TableHead>R2 截止</TableHead>
                  {canEdit ? <TableHead className="text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.program_name}</TableCell>
                    <TableCell className="text-sm">
                      {DEGREE_LEVEL_LABELS[p.degree_level as keyof typeof DEGREE_LEVEL_LABELS] ??
                        p.degree_level}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.major_category ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.application_deadline_round1 ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.application_deadline_round2 ?? '—'}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <ProgramFormDialog
                          mode="edit"
                          schoolId={school.id}
                          initial={{
                            id: p.id,
                            school_id: school.id,
                            program_name: p.program_name,
                            degree_level: p.degree_level as never,
                            major_category: p.major_category,
                            application_deadline_round1: p.application_deadline_round1,
                            application_deadline_round2: p.application_deadline_round2,
                            notes: p.notes,
                          }}
                          trigger={
                            <Button variant="ghost" size="sm">
                              編輯
                            </Button>
                          }
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
