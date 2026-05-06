'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  STAGE_LABELS,
  type StudentStatusRow,
  type StudentStatusStage,
} from '@/lib/constants/student-status'

import { changeStudentStatus } from '@/app/(dashboard)/students/actions'

type Props = {
  studentId: string
  currentStatus: StudentStatusRow
  /** All active statuses (admin-maintained), grouped & shown in the picker. */
  options: StudentStatusRow[]
  canEdit: boolean
}

export function StudentStatusChanger({ studentId, currentStatus, options, canEdit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const reset = () => {
    setTargetId(null)
    setNote('')
  }

  const target = options.find((o) => o.id === targetId) ?? null

  const handleSubmit = () => {
    if (!targetId) return
    startTransition(async () => {
      const result = await changeStudentStatus(studentId, targetId, note.trim() || null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`狀態已變更為「${target?.label_zh ?? '新狀態'}」`)
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  if (!canEdit) {
    return <StatusBadge label={currentStatus.label_zh} colorKey={currentStatus.color_key} />
  }

  // Group options by category (excluding the current status itself).
  const grouped = new Map<StudentStatusStage, StudentStatusRow[]>()
  for (const o of options) {
    if (o.id === currentStatus.id) continue
    const arr = grouped.get(o.category) ?? []
    arr.push(o)
    grouped.set(o.category, arr)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full transition-shadow hover:ring-2 hover:ring-ring"
        aria-label="變更狀態"
      >
        <span className="inline-flex items-center gap-1">
          <StatusBadge label={currentStatus.label_zh} colorKey={currentStatus.color_key} />
          <ChevronDown size={14} className="text-muted-foreground" />
        </span>
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>變更學生狀態</DialogTitle>
          <DialogDescription>從「{currentStatus.label_zh}」變更為下列狀態之一</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(['recruitment', 'closed', 'application', 'special'] as StudentStatusStage[]).map(
            (cat) => {
              const items = grouped.get(cat) ?? []
              if (items.length === 0) return null
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{STAGE_LABELS[cat]}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((s) => (
                      <Button
                        key={s.id}
                        type="button"
                        variant={targetId === s.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetId(s.id)}
                        disabled={pending}
                      >
                        {s.label_zh}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            },
          )}
          <div className="space-y-2">
            <Label htmlFor="status-note">備註(選填)</Label>
            <Textarea
              id="status-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="記錄變更原因或上下文..."
              rows={3}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !targetId}>
            {pending ? '變更中…' : '確認變更'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
