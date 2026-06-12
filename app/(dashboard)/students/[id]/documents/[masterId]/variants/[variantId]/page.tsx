import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft, GitFork } from 'lucide-react'

import { VariantEditor } from '@/components/documents/variant-editor'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { DOC_TYPE_LABELS, type DocumentType } from '@/lib/constants/document'
import { createClient } from '@/lib/supabase/server'

export default async function VariantEditorPage(props: {
  params: Promise<{ id: string; masterId: string; variantId: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')

  const { data: variant } = await supabase
    .from('documents_variants')
    .select(
      'id, master_id, application_id, current_version_id, master:documents_master!inner(id, doc_type, title, student_id)',
    )
    .eq('id', params.variantId)
    .eq('master_id', params.masterId)
    .maybeSingle()
  if (!variant) notFound()

  const masterRel = variant.master as {
    id: string
    doc_type: string
    title: string
    student_id: string
  } | null
  if (!masterRel || masterRel.student_id !== params.id) notFound()

  const { data: student } = await supabase
    .from('students')
    .select('full_name, frontend_consultant_id, backend_consultant_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!student) notFound()

  const { data: app } = await supabase
    .from('applications')
    .select('id, school:schools!inner(name_en, short_name), program:school_programs(program_name)')
    .eq('id', variant.application_id)
    .maybeSingle()
  const schoolDisplay = app
    ? (() => {
        const sch = app.school as { name_en: string; short_name: string | null } | null
        const prg = app.program as { program_name: string } | null
        const left = sch?.short_name ? `[${sch.short_name}] ${sch.name_en}` : (sch?.name_en ?? '?')
        return prg ? `${left} · ${prg.program_name}` : left
      })()
    : '(找不到對應申請)'

  const role = me.role as UserRole
  const canEdit =
    isManagerOrAdmin(role) ||
    student.frontend_consultant_id === user.id ||
    student.backend_consultant_id === user.id

  let currentContent = ''
  if (variant.current_version_id) {
    const { data: cur } = await supabase
      .from('documents_variant_versions')
      .select('content')
      .eq('id', variant.current_version_id)
      .maybeSingle()
    currentContent = (cur?.content ?? '') as string
  }

  const { data: versions } = await supabase
    .from('documents_variant_versions')
    .select(
      'id, version_number, word_count, word_diff_from_previous, change_note, modified_by, created_at',
    )
    .eq('variant_id', params.variantId)
    .order('version_number', { ascending: false })

  const modifierIds = Array.from(
    new Set((versions ?? []).map((v) => v.modified_by).filter((v): v is string => Boolean(v))),
  )
  const { data: modifiers } =
    modifierIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, display_name').in('id', modifierIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const modifierMap = new Map((modifiers ?? []).map((m) => [m.id, m.display_name || m.full_name]))

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
          href={`/students/${params.id}/documents/${params.masterId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回 Master「{masterRel.title}」
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {DOC_TYPE_LABELS[masterRel.doc_type as DocumentType] ?? masterRel.doc_type}
            </Badge>
            <Badge className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">
              <GitFork size={12} className="mr-1" />
              Variant
            </Badge>
            <h1 className="text-2xl font-semibold">{masterRel.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">套用申請:{schoolDisplay}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">字數餘額</p>
          <p className="text-xl font-bold tabular-nums">
            {remainingQuota === null ? '—' : remainingQuota.toLocaleString('zh-TW')}
          </p>
        </div>
      </header>

      <VariantEditor
        studentId={params.id}
        masterId={params.masterId}
        variantId={params.variantId}
        initialContent={currentContent}
        remainingQuota={remainingQuota}
        canEdit={canEdit}
      />

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
