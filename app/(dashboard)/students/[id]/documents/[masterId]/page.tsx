import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft, GitFork } from 'lucide-react'

import {
  ForkVariantDialog,
  type ForkApplicationOption,
} from '@/components/documents/fork-variant-dialog'
import { MasterEditor } from '@/components/documents/master-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { DOC_TYPE_LABELS, type DocumentType } from '@/lib/constants/document'
import { createClient } from '@/lib/supabase/server'

export default async function MasterEditorPage({
  params,
}: {
  params: { id: string; masterId: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')

  const { data: master } = await supabase
    .from('documents_master')
    .select('*')
    .eq('id', params.masterId)
    .eq('student_id', params.id)
    .maybeSingle()

  if (!master) notFound()

  const { data: student } = await supabase
    .from('students')
    .select('full_name, frontend_consultant_id, backend_consultant_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!student) notFound()

  const role = me.role as UserRole
  const canEdit =
    isManagerOrAdmin(role) ||
    student.frontend_consultant_id === user.id ||
    student.backend_consultant_id === user.id

  // Current version content
  let currentContent = ''
  if (master.current_version_id) {
    const { data: cur } = await supabase
      .from('documents_master_versions')
      .select('content')
      .eq('id', master.current_version_id)
      .maybeSingle()
    currentContent = (cur?.content ?? '') as string
  }

  // All versions for history
  const { data: versions } = await supabase
    .from('documents_master_versions')
    .select(
      'id, version_number, word_count, word_diff_from_previous, change_note, modified_by, created_at',
    )
    .eq('master_id', params.masterId)
    .order('version_number', { ascending: false })

  const modifierIds = Array.from(
    new Set((versions ?? []).map((v) => v.modified_by).filter((v): v is string => Boolean(v))),
  )
  const { data: modifiers } =
    modifierIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, display_name').in('id', modifierIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const modifierMap = new Map((modifiers ?? []).map((m) => [m.id, m.display_name || m.full_name]))

  // Variants of this master
  const { data: variants } = await supabase
    .from('documents_variants')
    .select(
      'id, application_id, current_version_id, is_finalized, application:applications!inner(id, school:schools!inner(name_en, short_name), program:school_programs(program_name))',
    )
    .eq('master_id', params.masterId)
    .order('created_at', { ascending: false })

  const variantVersionIds = (variants ?? [])
    .map((v) => v.current_version_id)
    .filter((v): v is string => Boolean(v))
  const { data: variantVersions } =
    variantVersionIds.length > 0
      ? await supabase
          .from('documents_variant_versions')
          .select('id, word_count, version_number')
          .in('id', variantVersionIds)
      : {
          data: [] as Array<{ id: string; word_count: number; version_number: number }>,
        }
  const variantVersionMap = new Map(
    (variantVersions ?? []).map((v) => [
      v.id,
      { word_count: v.word_count, version_number: v.version_number },
    ]),
  )

  // Applications for this student (for the fork dialog)
  const { data: apps } = await supabase
    .from('applications')
    .select('id, school:schools!inner(name_en, short_name), program:school_programs(program_name)')
    .eq('student_id', params.id)

  const forkedAppIds = new Set((variants ?? []).map((v) => v.application_id))
  const forkApplicationOptions: ForkApplicationOption[] = (apps ?? []).map((a) => {
    const sch = a.school as { name_en: string; short_name: string | null } | null
    const prg = a.program as { program_name: string } | null
    const schoolName = sch?.short_name
      ? `[${sch.short_name}] ${sch.name_en}`
      : (sch?.name_en ?? '?')
    return {
      application_id: a.id,
      school_name: schoolName,
      program_name: prg?.program_name ?? null,
      already_forked: forkedAppIds.has(a.id),
    }
  })

  // Current word_quota balance for this student (latest balance_after)
  const { data: lastLedger } = await supabase
    .from('word_quota_ledger')
    .select('balance_after')
    .eq('student_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const remainingQuota = (lastLedger?.balance_after as number | null | undefined) ?? null

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6">
      <div>
        <Link
          href={`/students/${params.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回 {student.full_name}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {DOC_TYPE_LABELS[master.doc_type as DocumentType] ?? master.doc_type}
            </Badge>
            <h1 className="text-2xl font-semibold">{master.title}</h1>
          </div>
          {master.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{master.description}</p>
          ) : null}
        </div>
        <div className="flex items-start gap-3">
          {canEdit && master.current_version_id ? (
            <ForkVariantDialog
              studentId={params.id}
              masterId={master.id}
              sourceMasterVersionId={master.current_version_id}
              applications={forkApplicationOptions}
              trigger={
                <Button variant="outline" size="sm">
                  <GitFork size={14} className="mr-1.5" />
                  Fork to School
                </Button>
              }
            />
          ) : null}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">字數餘額</p>
            <p className="text-xl font-bold tabular-nums">
              {remainingQuota === null ? '—' : remainingQuota.toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      </header>

      <MasterEditor
        studentId={params.id}
        masterId={master.id}
        initialContent={currentContent}
        remainingQuota={remainingQuota}
        canEdit={canEdit}
      />

      {variants && variants.length > 0 ? (
        <section>
          <h2 className="mb-2 text-base font-semibold">學校客製版(Variants)</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {variants.map((v) => {
              const ver = v.current_version_id ? variantVersionMap.get(v.current_version_id) : null
              const sch = (
                v.application as {
                  school: { name_en: string; short_name: string | null } | null
                  program: { program_name: string } | null
                } | null
              )?.school
              const prg = (
                v.application as {
                  school: { name_en: string; short_name: string | null } | null
                  program: { program_name: string } | null
                } | null
              )?.program
              const schoolDisplay = sch?.short_name
                ? `[${sch.short_name}] ${sch.name_en}`
                : (sch?.name_en ?? '?')
              return (
                <Link
                  key={v.id}
                  href={`/students/${params.id}/documents/${master.id}/variants/${v.id}`}
                  className="block"
                >
                  <Card className="transition-colors hover:border-primary">
                    <CardContent className="space-y-1.5 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{schoolDisplay}</span>
                        <span className="text-xs text-muted-foreground">
                          {ver ? `V${ver.version_number}` : '—'}
                        </span>
                      </div>
                      {prg?.program_name ? (
                        <p className="text-xs text-muted-foreground">{prg.program_name}</p>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          字數{' '}
                          <span className="tabular-nums text-foreground">
                            {ver ? ver.word_count.toLocaleString('zh-TW') : 0}
                          </span>
                        </span>
                        {v.is_finalized ? (
                          <Badge variant="secondary" className="text-xs">
                            已 finalize
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-base font-semibold">版本歷史</h2>
        {!versions || versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚未儲存任何版本。</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <span className="font-mono font-semibold">V{v.version_number}</span>
                    {v.change_note ? (
                      <span className="ml-2 text-muted-foreground">{v.change_note}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      字數 <span className="tabular-nums text-foreground">{v.word_count}</span>
                    </span>
                    {v.word_diff_from_previous > 0 ? (
                      <span className="tabular-nums text-destructive">
                        −{v.word_diff_from_previous}
                      </span>
                    ) : null}
                    <span>{v.modified_by ? (modifierMap.get(v.modified_by) ?? '?') : '?'}</span>
                    <span>
                      {new Date(v.created_at).toLocaleString('zh-TW', {
                        timeZone: 'Asia/Taipei',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
