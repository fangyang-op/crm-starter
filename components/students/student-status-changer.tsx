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
import { STUDENT_STATUS_CONFIG, type StudentStatus } from '@/lib/constants/student-status'
import { ALLOWED_TRANSITIONS } from '@/lib/constants/student-status-transitions'

import { changeStudentStatus } from '@/app/(dashboard)/students/actions'

type Props = {
  studentId: string
  currentStatus: StudentStatus
  canEdit: boolean
}

export function StudentStatusChanger({ studentId, currentStatus, canEdit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<StudentStatus | null>(null)
  const [note, setNote] = useState('')

  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
  const isTerminal = allowed.length === 0

  const reset = () => {
    setTarget(null)
    setNote('')
  }

  const handleSubmit = () => {
    if (!target) return
    startTransition(async () => {
      const result = await changeStudentStatus(studentId, target, note.trim() || null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`狀態已變更為「${STUDENT_STATUS_CONFIG[target].label}」`)
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  if (!canEdit || isTerminal) {
    return <StatusBadge status={currentStatus} />
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
          <StatusBadge status={currentStatus} />
          <ChevronDown size={14} className="text-muted-foreground" />
        </span>
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>變更學生狀態</DialogTitle>
          <DialogDescription>
            從「{STUDENT_STATUS_CONFIG[currentStatus].label}」變更為下列狀態之一
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allowed.map((s) => (
              <Button
                key={s}
                type="button"
                variant={target === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTarget(s)}
                disabled={pending}
              >
                {STUDENT_STATUS_CONFIG[s].label}
              </Button>
            ))}
          </div>
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
          <Button onClick={handleSubmit} disabled={pending || !target}>
            {pending ? '變更中…' : '確認變更'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
