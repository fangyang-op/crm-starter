'use client'

import { useState, useTransition } from 'react'

import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { changeOwnPassword } from './actions'

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const r = await changeOwnPassword({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      })
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success('密碼已更新,下次登入請使用新密碼')
      setCurrent('')
      setNext('')
      setConfirm('')
    })
  }

  const fieldError = (key: string) => errors[key]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">修改密碼</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current">目前密碼</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="current"
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? '隱藏' : '顯示'}
              className="shrink-0"
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
          {fieldError('current_password') ? (
            <p className="text-xs text-destructive">{fieldError('current_password')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new">新密碼</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="new"
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNext((v) => !v)}
              aria-label={showNext ? '隱藏' : '顯示'}
              className="shrink-0"
            >
              {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">至少 8 字元,需含大小寫字母與數字。</p>
          {fieldError('new_password') ? (
            <p className="text-xs text-destructive">{fieldError('new_password')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">確認新密碼</Label>
          <Input
            id="confirm"
            type={showNext ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={pending}
          />
          {fieldError('confirm_password') ? (
            <p className="text-xs text-destructive">{fieldError('confirm_password')}</p>
          ) : null}
        </div>

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? '更新中…' : '更新密碼'}
        </Button>
      </CardContent>
    </Card>
  )
}
