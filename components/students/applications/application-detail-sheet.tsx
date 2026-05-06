'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Copy, Eye, EyeOff, ExternalLink, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_VALUES,
  type ApplicationStatus,
} from '@/lib/constants/application-status'

import {
  revealApplicationPortalPassword,
  updateApplicationMeta,
  updateApplicationPortal,
  updateApplicationStatus,
} from '@/app/(dashboard)/students/[id]/applications/actions'

import type { ApplicationRow } from './applications-view'

type Props = {
  studentId: string
  application: ApplicationRow | null
  canEdit: boolean
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function ApplicationDetailSheet({
  studentId,
  application,
  canEdit,
  open,
  onOpenChange,
}: Props) {
  // We render only when there's an active application — early return keeps
  // the form below untouched between opens.
  if (!application) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl" />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{application.school_name}</SheetTitle>
          <SheetDescription>
            {application.program_label}
            {application.application_round ? ` · ${application.application_round}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <StatusBlock studentId={studentId} app={application} canEdit={canEdit} />
          <MetaBlock studentId={studentId} app={application} canEdit={canEdit} />
          <PortalBlock studentId={studentId} app={application} canEdit={canEdit} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Status block
// ============================================================================
function StatusBlock({
  studentId,
  app,
  canEdit,
}: {
  studentId: string
  app: ApplicationRow
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    startTransition(async () => {
      const r = await updateApplicationStatus(studentId, {
        application_id: app.id,
        status: next,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`狀態已變更為「${APPLICATION_STATUS_CONFIG[next as ApplicationStatus].label}」`)
      router.refresh()
    })
  }

  const cfg = APPLICATION_STATUS_CONFIG[app.status]

  return (
    <section className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">狀態</p>
        <Badge variant="outline" className={cn('border', cfg.badgeClass)}>
          {cfg.label}
        </Badge>
      </div>
      {canEdit ? (
        <Select value={app.status} onValueChange={handleChange} disabled={pending}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPLICATION_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          <p>送出時間</p>
          <p className="font-medium text-foreground">
            {app.submitted_at ? formatDateTime(app.submitted_at) : '—'}
          </p>
        </div>
        <div>
          <p>結果時間</p>
          <p className="font-medium text-foreground">
            {app.decision_at ? formatDateTime(app.decision_at) : '—'}
          </p>
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// Meta block — round / deadline / fee / notes
// ============================================================================
function MetaBlock({
  studentId,
  app,
  canEdit,
}: {
  studentId: string
  app: ApplicationRow
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [round, setRound] = useState(app.application_round ?? '')
  const [deadline, setDeadline] = useState(app.deadline ?? '')
  const [fee, setFee] = useState<string>(
    app.application_fee !== null ? String(app.application_fee) : '',
  )
  const [feePaid, setFeePaid] = useState(app.application_fee_paid)
  const [notes, setNotes] = useState(app.notes ?? '')
  const [decisionNotes, setDecisionNotes] = useState(app.decision_notes ?? '')

  // Reset local form when switching to a different application.
  useEffect(() => {
    setRound(app.application_round ?? '')
    setDeadline(app.deadline ?? '')
    setFee(app.application_fee !== null ? String(app.application_fee) : '')
    setFeePaid(app.application_fee_paid)
    setNotes(app.notes ?? '')
    setDecisionNotes(app.decision_notes ?? '')
  }, [
    app.id,
    app.application_round,
    app.deadline,
    app.application_fee,
    app.application_fee_paid,
    app.notes,
    app.decision_notes,
  ])

  const submit = () => {
    let feeNum: number | null = null
    if (fee.trim() !== '') {
      const n = Number(fee)
      if (!Number.isFinite(n) || n < 0) {
        toast.error('申請費必須是非負數')
        return
      }
      feeNum = n
    }
    startTransition(async () => {
      const r = await updateApplicationMeta(studentId, {
        application_id: app.id,
        application_round: round.trim() || null,
        deadline: deadline.trim() || null,
        application_fee: feeNum,
        application_fee_paid: feePaid,
        notes: notes.trim() || null,
        decision_notes: decisionNotes.trim() || null,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已更新')
      router.refresh()
    })
  }

  const readOnly = !canEdit

  return (
    <section className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">申請資訊</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="round" className="text-xs">
            申請輪
          </Label>
          <Input
            id="round"
            value={round}
            onChange={(e) => setRound(e.target.value)}
            placeholder="例:Round 1 / EA / RD"
            disabled={readOnly || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="deadline" className="text-xs">
            截止日期
          </Label>
          <Input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={readOnly || pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fee" className="text-xs">
            申請費(USD)
          </Label>
          <Input
            id="fee"
            type="number"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="例:90"
            disabled={readOnly || pending}
          />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox
            id="fee-paid"
            checked={feePaid}
            onCheckedChange={(v) => setFeePaid(v === true)}
            disabled={readOnly || pending}
          />
          <Label htmlFor="fee-paid" className="text-xs">
            已繳費
          </Label>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes" className="text-xs">
          一般備註
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={readOnly || pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="decision-notes" className="text-xs">
          結果備註
        </Label>
        <Textarea
          id="decision-notes"
          value={decisionNotes}
          onChange={(e) => setDecisionNotes(e.target.value)}
          rows={2}
          placeholder="錄取條件、獎學金金額、補件內容…"
          disabled={readOnly || pending}
        />
      </div>
      {canEdit ? (
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? '儲存中…' : '儲存申請資訊'}
        </Button>
      ) : null}
    </section>
  )
}

// ============================================================================
// Portal block — URL / username / password (encrypted) / notes
// ============================================================================
function PortalBlock({
  studentId,
  app,
  canEdit,
}: {
  studentId: string
  app: ApplicationRow
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [revealing, startReveal] = useTransition()

  const [url, setUrl] = useState(app.portal_url ?? '')
  const [username, setUsername] = useState(app.portal_username ?? '')
  const [notes, setNotes] = useState(app.portal_notes ?? '')

  // Password edit mode: 'unchanged' | 'set' | 'clear'
  const [pwMode, setPwMode] = useState<'unchanged' | 'set' | 'clear'>('unchanged')
  const [newPassword, setNewPassword] = useState('')
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    setUrl(app.portal_url ?? '')
    setUsername(app.portal_username ?? '')
    setNotes(app.portal_notes ?? '')
    setPwMode('unchanged')
    setNewPassword('')
    setRevealedPassword(null)
    setShowNew(false)
  }, [app.id, app.portal_url, app.portal_username, app.portal_notes])

  const handleReveal = () => {
    startReveal(async () => {
      const r = await revealApplicationPortalPassword(app.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setRevealedPassword(r.password)
    })
  }

  const handleCopyUsername = async () => {
    if (!app.portal_username) return
    try {
      await navigator.clipboard.writeText(app.portal_username)
      toast.success('已複製帳號')
    } catch {
      toast.error('複製失敗')
    }
  }

  const handleCopyPassword = async () => {
    const r = await revealApplicationPortalPassword(app.id)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    try {
      await navigator.clipboard.writeText(r.password)
      toast.success('已複製密碼到剪貼簿')
    } catch {
      toast.error('複製失敗')
    }
  }

  const submit = () => {
    if (pwMode === 'set' && !newPassword.trim()) {
      toast.error('請輸入新密碼,或選「清除密碼」')
      return
    }
    startTransition(async () => {
      const r = await updateApplicationPortal(studentId, {
        application_id: app.id,
        portal_url: url.trim() || null,
        portal_username: username.trim() || null,
        portal_password: pwMode === 'set' ? newPassword : null,
        set_password: pwMode !== 'unchanged',
        portal_notes: notes.trim() || null,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已更新 Portal 資訊')
      setPwMode('unchanged')
      setNewPassword('')
      setRevealedPassword(null)
      router.refresh()
    })
  }

  const readOnly = !canEdit

  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Portal 帳密</p>
        {app.has_portal_password ? (
          <Badge variant="outline" className="text-[10px]">
            <KeyRound size={10} className="mr-1" />
            已設定
          </Badge>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="portal-url" className="text-xs">
          Portal URL
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="portal-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://portal.example.edu/login"
            disabled={readOnly || pending}
          />
          {app.portal_url ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              asChild
              aria-label="開啟"
              className="shrink-0"
            >
              <a href={app.portal_url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="portal-username" className="text-xs">
          帳號
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="portal-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={readOnly || pending}
          />
          {app.portal_username ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyUsername}
              aria-label="複製帳號"
              className="shrink-0"
            >
              <Copy size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">密碼</Label>
        {app.has_portal_password && pwMode === 'unchanged' ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={revealedPassword ?? '••••••••••'}
              readOnly
              className="font-mono"
              type={revealedPassword ? 'text' : 'password'}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => (revealedPassword ? setRevealedPassword(null) : handleReveal())}
              disabled={revealing || pending}
              aria-label={revealedPassword ? '隱藏' : '顯示'}
              className="shrink-0"
            >
              {revealedPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyPassword}
              disabled={revealing || pending}
              aria-label="複製密碼"
              className="shrink-0"
            >
              <Copy size={14} />
            </Button>
          </div>
        ) : null}

        {pwMode === 'set' ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type={showNew ? 'text' : 'password'}
              placeholder="輸入新密碼"
              disabled={pending}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? '隱藏' : '顯示'}
              className="shrink-0"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
        ) : null}

        {pwMode === 'clear' ? (
          <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
            儲存後將清除目前的密碼。
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-1.5">
            {pwMode === 'unchanged' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPwMode('set')}
                  disabled={pending}
                >
                  {app.has_portal_password ? '變更密碼' : '設定密碼'}
                </Button>
                {app.has_portal_password ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPwMode('clear')}
                    disabled={pending}
                  >
                    清除密碼
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPwMode('unchanged')
                  setNewPassword('')
                }}
                disabled={pending}
              >
                取消變更密碼
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="portal-notes" className="text-xs">
          Portal 備註
        </Label>
        <Textarea
          id="portal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="安全提示、密保問題、推薦人 portal…"
          disabled={readOnly || pending}
        />
      </div>

      {canEdit ? (
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? '儲存中…' : '儲存 Portal'}
        </Button>
      ) : null}
    </section>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
