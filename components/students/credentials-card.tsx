'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Copy, Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
  createCredential,
  deleteCredential,
  revealCredentialPassword,
  updateCredential,
} from '@/app/(dashboard)/students/[id]/credentials/actions'

export type CredentialItem = {
  id: string
  label: string
  url: string | null
  account: string | null
  has_password: boolean
  notes: string | null
}

type Props = {
  studentId: string
  type: 'visa' | 'housing'
  title: string
  items: CredentialItem[]
  /** False when student has no enrolled application yet — locks the card. */
  unlocked: boolean
  canEdit: boolean
}

export function CredentialsCard({ studentId, type, title, items, unlocked, canEdit }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound size={16} />
          {title}
          {!unlocked ? (
            <Badge variant="outline" className="ml-2 text-[10px]">
              🔒 待學生確定入學後啟用
            </Badge>
          ) : null}
        </CardTitle>
        {unlocked && canEdit ? (
          <CredentialDialog mode="create" studentId={studentId} type={type} />
        ) : null}
      </CardHeader>
      <CardContent>
        {!unlocked ? (
          <p className="text-sm text-muted-foreground">
            學生至少需有一所申請校狀態為「確定入學」後,此區塊才會啟用。
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚未建立。</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <CredentialRow key={it.id} studentId={studentId} item={it} canEdit={canEdit} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CredentialRow({
  studentId,
  item,
  canEdit,
}: {
  studentId: string
  item: CredentialItem
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [revealing, startReveal] = useTransition()
  const [revealed, setRevealed] = useState<string | null>(null)

  const handleReveal = () => {
    startReveal(async () => {
      const r = await revealCredentialPassword(item.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setRevealed(r.password)
    })
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已複製${label}`)
    } catch {
      toast.error('複製失敗')
    }
  }

  const handleCopyPassword = async () => {
    const r = await revealCredentialPassword(item.id)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    handleCopy(r.password, '密碼')
  }

  const handleDelete = () => {
    startTransition(async () => {
      const r = await deleteCredential(studentId, item.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已刪除')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.label}</p>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-xs text-primary hover:underline"
            >
              {item.url}
            </a>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex items-center gap-1">
            <CredentialDialog
              mode="edit"
              studentId={studentId}
              type="visa"
              initial={item}
              trigger={
                <Button variant="ghost" size="sm">
                  編輯
                </Button>
              }
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pending}>
                  <Trash2 size={13} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定刪除這組帳密?</AlertDialogTitle>
                  <AlertDialogDescription>此動作無法還原。</AlertDialogDescription>
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

      <div className="grid grid-cols-[80px_1fr] items-center gap-y-1 text-xs">
        <span className="text-muted-foreground">帳號</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono">{item.account ?? '—'}</span>
          {item.account ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCopy(item.account!, '帳號')}
            >
              <Copy size={11} />
            </Button>
          ) : null}
        </div>
        <span className="text-muted-foreground">密碼</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono">{item.has_password ? (revealed ?? '••••••••') : '—'}</span>
          {item.has_password ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={revealing}
                onClick={() => (revealed ? setRevealed(null) : handleReveal())}
              >
                {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={revealing}
                onClick={handleCopyPassword}
              >
                <Copy size={11} />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {item.notes ? (
        <p className="rounded bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
          {item.notes}
        </p>
      ) : null}
    </div>
  )
}

function CredentialDialog({
  mode,
  studentId,
  type,
  initial,
  trigger,
}: {
  mode: 'create' | 'edit'
  studentId: string
  type: 'visa' | 'housing'
  initial?: CredentialItem
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [label, setLabel] = useState(initial?.label ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [account, setAccount] = useState(initial?.account ?? '')
  const [password, setPassword] = useState('')
  const [setPasswordEnabled, setSetPasswordEnabled] = useState(mode === 'create')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const submit = () => {
    startTransition(async () => {
      if (mode === 'create') {
        const r = await createCredential(studentId, {
          credential_type: type,
          label,
          url: url || null,
          account: account || null,
          password: password || null,
          notes: notes || null,
        })
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success('已新增')
      } else {
        const r = await updateCredential(studentId, initial!.id, {
          label,
          url: url || null,
          account: account || null,
          password: setPasswordEnabled ? password || null : undefined,
          notes: notes || null,
        })
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success('已更新')
      }
      setOpen(false)
      setPassword('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus size={12} className="mr-1.5" />
            新增
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新增' : '編輯'}
            {type === 'visa' ? '簽證' : '住宿'}帳密
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cred-label">名稱</Label>
            <Input
              id="cred-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={type === 'visa' ? '例:美國 F1 簽證' : '例:USC 學生宿舍 portal'}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-url">網址</Label>
            <Input
              id="cred-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-account">帳號</Label>
            <Input
              id="cred-account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-password">密碼</Label>
            {mode === 'edit' ? (
              <label className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={setPasswordEnabled}
                  onChange={(e) => setSetPasswordEnabled(e.target.checked)}
                />
                變更密碼(留空表示清除)
              </label>
            ) : null}
            <Input
              id="cred-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending || (mode === 'edit' && !setPasswordEnabled)}
              placeholder={mode === 'edit' ? '輸入新密碼或留空清除' : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cred-notes">備註</Label>
            <Textarea
              id="cred-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !label.trim()}>
            {pending ? '儲存中…' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
