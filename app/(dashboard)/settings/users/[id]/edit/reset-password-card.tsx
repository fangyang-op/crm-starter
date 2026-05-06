'use client'

import { useState, useTransition } from 'react'

import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateRandomPassword } from '@/lib/validators/auth'

import { resetUserPassword } from '../../actions'

type Props = {
  targetUserId: string
  targetName: string
  isSelf: boolean
}

export function ResetPasswordCard({ targetUserId, targetName, isSelf }: Props) {
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const fill = () => {
    const p = generateRandomPassword()
    setPassword(p)
    setShow(true)
  }

  const submit = () => {
    setErrors({})
    if (!password) {
      setErrors({ new_password: ['請輸入新密碼,或點「產生隨機密碼」'] })
      return
    }
    startTransition(async () => {
      const r = await resetUserPassword({ user_id: targetUserId, new_password: password })
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      // Show the password ONE final time so admin can copy it; never persist it.
      setIssued(password)
      setPassword('')
      setShow(false)
      toast.success(`已重置 ${targetName} 的密碼`)
    })
  }

  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued)
      toast.success('已複製到剪貼簿')
    } catch {
      toast.error('複製失敗')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound size={16} />
          重置密碼
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSelf ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            如要修改自己的密碼,建議用「
            <a href="/account/security" className="font-medium underline">
              帳號安全
            </a>
            」頁,需要驗證目前密碼。這裡的重置會繞過驗證。
          </p>
        ) : null}

        {issued ? (
          <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-sm font-medium text-emerald-900">
              已重置成功。請以安全管道告知 {targetName}:
            </p>
            <div className="flex items-center gap-2">
              <Input value={issued} readOnly className="font-mono" />
              <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="複製">
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-xs text-emerald-800">
              這組密碼只在這裡顯示一次,離開頁面後就無法再看到。
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIssued(null)}>
              再重置一次
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">新密碼</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? '隱藏' : '顯示'}
                  className="shrink-0"
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">至少 8 字元,需含大小寫字母與數字。</p>
              {errors.new_password ? (
                <p className="text-xs text-destructive">{errors.new_password[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fill} disabled={pending}>
                <RefreshCw size={12} className="mr-1.5" />
                產生隨機密碼
              </Button>
              <Button onClick={submit} disabled={pending} className="ml-auto">
                {pending ? '重置中…' : '確認重置'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
