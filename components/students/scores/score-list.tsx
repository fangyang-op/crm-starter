'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Download, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  ScoreFormSheet,
  type ScoreFormInitial,
} from '@/components/students/scores/score-form-sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SCORE_TYPE_CONFIG, type ScoreType } from '@/lib/constants/score-type'

import {
  deleteScore,
  getCertificateSignedUrl,
} from '@/app/(dashboard)/students/[id]/scores/actions'

export type ScoreListItem = {
  id: string
  score_type: ScoreType
  total_score: string | null
  sub_scores: Record<string, string | number | null> | null
  test_date: string | null
  expiry_date: string | null
  is_official: boolean
  notes: string | null
  certificate_storage_path: string | null
  created_at: string
  status: 'preliminary' | 'confirmed'
}

type Props = {
  studentId: string
  scores: ScoreListItem[]
  canEdit: boolean
}

export function ScoreList({ studentId, scores, canEdit }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScoreFormInitial | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }

  const openEdit = (s: ScoreListItem) => {
    setEditing({
      id: s.id,
      score_type: s.score_type,
      total_score: s.total_score,
      sub_scores: s.sub_scores,
      test_date: s.test_date,
      expiry_date: s.expiry_date,
      is_official: s.is_official,
      notes: s.notes,
      certificate_storage_path: s.certificate_storage_path,
    })
    setOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {scores.length} 筆成績</p>
        {canEdit ? (
          <Button onClick={openCreate} size="sm">
            <Plus size={14} className="mr-1.5" />
            新增成績
          </Button>
        ) : null}
      </div>

      {scores.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <h3 className="text-sm font-medium">尚無成績紀錄</h3>
          <p className="mt-1 text-xs text-muted-foreground">點右上「新增成績」開始記錄。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {scores.map((s) => (
            <ScoreCard
              key={s.id}
              studentId={studentId}
              score={s}
              canEdit={canEdit}
              onEdit={() => openEdit(s)}
            />
          ))}
        </div>
      )}

      <ScoreFormSheet studentId={studentId} initial={editing} open={open} onOpenChange={setOpen} />
    </div>
  )
}

function ScoreCard({
  studentId,
  score,
  canEdit,
  onEdit,
}: {
  studentId: string
  score: ScoreListItem
  canEdit: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [downloading, startDownload] = useTransition()

  const cfg = SCORE_TYPE_CONFIG[score.score_type]
  const expired = isExpired(score.expiry_date)

  const handleDelete = () => {
    startTransition(async () => {
      const r = await deleteScore(studentId, score.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已刪除成績')
      router.refresh()
    })
  }

  const handleDownload = () => {
    if (!score.certificate_storage_path) return
    startDownload(async () => {
      const r = await getCertificateSignedUrl(score.certificate_storage_path!)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }

  const subEntries = Object.entries(score.sub_scores ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('border', cfg.badgeClass)}>
              {cfg.label}
            </Badge>
            {score.status === 'preliminary' ? (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-[10px] text-amber-700"
              >
                初步
              </Badge>
            ) : null}
            {score.is_official ? (
              <Badge variant="outline" className="text-[10px]">
                正本送分
              </Badge>
            ) : null}
            {expired ? (
              <Badge
                variant="outline"
                className="border-rose-300 bg-rose-50 text-[10px] text-rose-700"
              >
                已過期
              </Badge>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil size={13} />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={pending}
                    aria-label="刪除"
                  >
                    <Trash2 size={13} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>刪除這筆成績?</AlertDialogTitle>
                    <AlertDialogDescription>
                      將同時移除附帶的證書檔案。歷史 activity_log 會保留刪除紀錄。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={pending}>
                      刪除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xl font-bold tabular-nums">{score.total_score ?? '—'}</p>
          {subEntries.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subEntries.map(([k, v]) => `${k}: ${v}`).join('  ·  ')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {score.test_date ? <span>考試 {score.test_date}</span> : null}
          {score.expiry_date ? (
            <span className={expired ? 'text-rose-700' : ''}>到期 {score.expiry_date}</span>
          ) : null}
        </div>

        {score.notes ? (
          <p className="rounded bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
            {score.notes}
          </p>
        ) : null}

        {score.certificate_storage_path ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full"
          >
            <FileText size={13} className="mr-1.5" />
            {downloading ? '產生連結中…' : '下載證書'}
            <Download size={12} className="ml-auto" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function isExpired(date: string | null): boolean {
  if (!date) return false
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  return date < today
}
