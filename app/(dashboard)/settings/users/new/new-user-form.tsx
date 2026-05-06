'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEPARTMENT_LABELS, DEPARTMENT_VALUES, type Department } from '@/lib/constants/department'
import { ROLE_LABELS, type UserRole } from '@/lib/constants/roles'
import { generateRandomPassword } from '@/lib/validators/auth'

import { adminCreateUser } from '../actions'

const ROLE_VALUES: UserRole[] = ['consultant', 'manager_frontend', 'manager_backend', 'admin']

const NONE_DEPT = '__none__'

export function NewUserForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('consultant')
  const [department, setDepartment] = useState<string>('frontend')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const fillRandom = () => {
    setPassword(generateRandomPassword())
    setShow(true)
  }

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const r = await adminCreateUser({
        email: email.trim(),
        full_name: fullName.trim(),
        display_name: displayName.trim() || undefined,
        role,
        department: department === NONE_DEPT ? null : (department as Department),
        password,
      })
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      // Show the issued password ONE last time so admin can copy + share.
      setIssued(password)
      toast.success(`已建立 ${fullName} 的帳號`)
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

  const goToList = () => router.push('/settings/users')

  const fieldErr = (k: string) => errors[k]?.[0]

  if (issued) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-emerald-700">帳號建立成功</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">請以安全管道告知 {fullName} 以下登入資訊:</p>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} readOnly className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>初始密碼</Label>
            <div className="flex items-center gap-1.5">
              <Input value={issued} readOnly className="font-mono" />
              <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="複製">
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              這組密碼只在這裡顯示一次,離開此頁後無法再看到。
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={goToList}>
              回到用戶列表
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">基本資料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@example.com"
            disabled={pending}
            autoComplete="off"
          />
          {fieldErr('email') ? (
            <p className="text-xs text-destructive">{fieldErr('email')}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">中文姓名</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={pending}
            />
            {fieldErr('full_name') ? (
              <p className="text-xs text-destructive">{fieldErr('full_name')}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">顯示名稱(選填)</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例:Marcus"
              disabled={pending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={pending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_VALUES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>部門</Label>
            <Select value={department} onValueChange={setDepartment} disabled={pending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_DEPT}>未指定</SelectItem>
                {DEPARTMENT_VALUES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">初始密碼</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillRandom}
              disabled={pending}
              className="shrink-0"
            >
              <RefreshCw size={12} className="mr-1.5" />
              隨機
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">至少 8 字元,含大小寫與數字。</p>
          {fieldErr('password') ? (
            <p className="text-xs text-destructive">{fieldErr('password')}</p>
          ) : null}
        </div>

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? '建立中…' : '建立帳號'}
        </Button>
      </CardContent>
    </Card>
  )
}
