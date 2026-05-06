import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'

import { MasterEditor } from '@/components/documents/master-editor'
import { Badge } from '@/components/ui/badge'
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
        <div className="text-right">
          <p className="text-xs text-muted-foreground">字數餘額</p>
          <p className="text-xl font-bold tabular-nums">
            {remainingQuota === null ? '—' : remainingQuota.toLocaleString('zh-TW')}
          </p>
        </div>
      </header>

      <MasterEditor
        studentId={params.id}
        masterId={master.id}
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
