'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { CalendarClock, FileText } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  createDefer,
  getDeferAgreementSignedUrl,
} from '@/app/(dashboard)/students/[id]/defer/actions'

export type DeferRecord = {
  id: string
  original_enrollment_date: string | null
  new_enrollment_date: string
  reason: string | null
  agreement_file_path: string
  created_at: string
}

type Props = {
  studentId: string
  records: DeferRecord[]
  /** Eligible: student status is one of decision_making / pre_departure / enrolled. */
  eligible: boolean
  canEdit: boolean
}

export function DeferCard({ studentId, records, eligible, canEdit }: Props) {
  const latest = records[0] ?? null
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock size={16} />
          延後入學 (Defer)
          {records.length > 0 ? (
            <Badge variant="outline" className="ml-2 text-[10px]">
              已 Defer {records.length} 次
            </Badge>
          ) : null}
        </CardTitle>
        {eligible && canEdit ? <DeferDialog studentId={studentId} /> : null}
      </CardHeader>
      <CardContent>
        {!eligible ? (
          <p className="text-sm text-muted-foreground">
            此學生目前狀態不適用 Defer(僅在「錄取確認 / 入學準備 / 已入學」階段啟用)。
          </p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚未 Defer。</p>
        ) : (
          <div className="space-y-2">
            {latest ? <DeferRow record={latest} highlight /> : null}
            {records.length > 1 ? (
              <details className="rounded-md border bg-muted/30 p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  歷史 Defer ({records.length - 1} 筆)
                </summary>
                <div className="mt-2 space-y-1.5">
                  {records.slice(1).map((r) => (
                    <DeferRow key={r.id} record={r} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeferRow({ record, highlight }: { record: DeferRecord; highlight?: boolean }) {
  const [downloading, startDownload] = useTransition()
  const handleDownload = () => {
    startDownload(async () => {
      const r = await getDeferAgreementSignedUrl(record.agreement_file_path)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }
  return (
    <div
      className={
        highlight
          ? 'space-y-1.5 rounded-md border-2 border-amber-300 bg-amber-50 p-3 text-sm'
          : 'space-y-1.5 rounded-md border p-3 text-sm'
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {record.original_enrollment_date ? `${record.original_enrollment_date} → ` : ''}
          <span className="tabular-nums">{record.new_enrollment_date}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          <FileText size={12} className="mr-1.5" />
          {downloading ? '產生連結…' : '同意書'}
        </Button>
      </div>
      {record.reason ? <p className="text-xs text-muted-foreground">原因:{record.reason}</p> : null}
      <p className="text-[11px] text-muted-foreground">
        提交於 {new Date(record.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
      </p>
    </div>
  )
}

function DeferDialog({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [oldDate, setOldDate] = useState('')
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const reset = () => {
    setOldDate('')
    setNewDate('')
    setReason('')
    setFile(null)
  }

  const submit = () => {
    if (!newDate) {
      toast.error('請填寫新入學日期')
      return
    }
    if (!file) {
      toast.error('請上傳延後入學同意書 (PDF)')
      return
    }
    const fd = new FormData()
    if (oldDate) fd.set('original_enrollment_date', oldDate)
    fd.set('new_enrollment_date', newDate)
    fd.set('reason', reason)
    fd.set('file', file)
    startTransition(async () => {
      const r = await createDefer(studentId, fd)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已記錄 Defer')
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Defer 延後入學
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Defer 延後入學</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="old-date">原入學日期(選填)</Label>
            <Input
              id="old-date"
              type="date"
              value={oldDate}
              onChange={(e) => setOldDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-date">
              新入學日期<span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defer-reason">原因(選填)</Label>
            <Textarea
              id="defer-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              延後入學同意書 (PDF)<span className="text-destructive">*</span>
            </Label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={pending}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
            />
            {file ? (
              <p className="text-xs text-muted-foreground">已選:{file.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">必填,僅接受 PDF。</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !newDate || !file}>
            {pending ? '提交中…' : '確認 Defer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
