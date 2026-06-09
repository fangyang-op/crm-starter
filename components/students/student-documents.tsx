import Link from 'next/link'

import { FileText, Plus } from 'lucide-react'

import { NewMasterDialog } from '@/components/documents/new-master-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DOC_TYPE_LABELS, type DocumentType } from '@/lib/constants/document'
import { createClient } from '@/lib/supabase/server'

type Props = {
  studentId: string
  canCreate: boolean
}

export async function StudentDocuments({ studentId, canCreate }: Props) {
  const supabase = await createClient()

  const [{ data: masters }, { data: lastLedger }] = await Promise.all([
    supabase
      .from('documents_master')
      .select('id, doc_type, title, description, current_version_id, updated_at, is_archived')
      .eq('student_id', studentId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false }),
    supabase
      .from('word_quota_ledger')
      .select('balance_after')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const remainingQuota = (lastLedger?.balance_after as number | null | undefined) ?? null

  // Fetch current version word_count for each master (one query)
  const versionIds = (masters ?? [])
    .map((m) => m.current_version_id)
    .filter((v): v is string => Boolean(v))
  const { data: versions } =
    versionIds.length > 0
      ? await supabase
          .from('documents_master_versions')
          .select('id, word_count, version_number')
          .in('id', versionIds)
      : { data: [] as Array<{ id: string; word_count: number; version_number: number }> }
  const versionMap = new Map(
    (versions ?? []).map((v) => [
      v.id,
      { word_count: v.word_count, version_number: v.version_number },
    ]),
  )

  const newButton = canCreate ? (
    <NewMasterDialog
      studentId={studentId}
      trigger={
        <Button>
          <Plus className="mr-1.5" size={16} />
          新建 Master
        </Button>
      }
    />
  ) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="text-sm">
          <span className="text-muted-foreground">字數餘額 · </span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {remainingQuota === null ? '—' : remainingQuota.toLocaleString('zh-TW')}
          </span>
        </div>
        {newButton}
      </div>

      {!masters || masters.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="尚無 Master 文件"
          description={
            canCreate
              ? '建立第一份 Master(學生層級主版),之後可以為每所學校 Fork 客製版。'
              : '此學生尚未建立任何文件。'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {masters.map((m) => {
            const v = m.current_version_id ? versionMap.get(m.current_version_id) : null
            return (
              <Link key={m.id} href={`/students/${studentId}/documents/${m.id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {DOC_TYPE_LABELS[m.doc_type as DocumentType] ?? m.doc_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {v ? `V${v.version_number}` : '尚未撰寫'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold">{m.title}</h3>
                    {m.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                    ) : null}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        字數{' '}
                        <span className="tabular-nums text-foreground">
                          {v ? v.word_count.toLocaleString('zh-TW') : 0}
                        </span>
                      </span>
                      <span>
                        最後更新{' '}
                        {new Date(m.updated_at).toLocaleDateString('zh-TW', {
                          timeZone: 'Asia/Taipei',
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
