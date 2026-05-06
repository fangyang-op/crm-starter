'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

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

import { adminSetUserActive, adminUpdateUserProfile } from '../../actions'

const ROLE_VALUES: UserRole[] = ['consultant', 'manager_frontend', 'manager_backend', 'admin']
const NONE_DEPT = '__none__'

type Props = {
  userId: string
  isSelf: boolean
  initial: {
    full_name: string
    display_name: string | null
    role: UserRole
    department: Department | null
    is_active: boolean
  }
}

export function ProfileEditCard({ userId, isSelf, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activePending, startActiveTransition] = useTransition()

  const [fullName, setFullName] = useState(initial.full_name)
  const [displayName, setDisplayName] = useState(initial.display_name ?? '')
  const [role, setRole] = useState<UserRole>(initial.role)
  const [department, setDepartment] = useState<string>(initial.department ?? NONE_DEPT)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const r = await adminUpdateUserProfile({
        user_id: userId,
        full_name: fullName.trim(),
        display_name: displayName.trim() || null,
        role,
        department: department === NONE_DEPT ? null : (department as Department),
      })
      if (!r.ok) {
        if (r.fieldErrors) setErrors(r.fieldErrors)
        toast.error(r.error)
        return
      }
      toast.success('已更新')
      router.refresh()
    })
  }

  const toggleActive = () => {
    const next = !initial.is_active
    startActiveTransition(async () => {
      const r = await adminSetUserActive(userId, next)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(next ? '已啟用' : '已停用')
      router.refresh()
    })
  }

  const fieldErr = (k: string) => errors[k]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">基本資料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <Label htmlFor="display-name">顯示名稱</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="(選填)"
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
            {isSelf && role !== 'admin' ? (
              <p className="text-xs text-amber-700">不可將自己降級;送出時會被擋下。</p>
            ) : null}
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

        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? '儲存中…' : '儲存基本資料'}
        </Button>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="text-sm">
            <p className="font-medium">帳號狀態</p>
            <p className="text-xs text-muted-foreground">
              {initial.is_active ? '啟用中,可登入系統' : '已停用,Auth 端已封鎖無法登入'}
            </p>
          </div>
          {isSelf ? (
            <Button variant="outline" size="sm" disabled>
              不可停用自己
            </Button>
          ) : (
            <Button
              variant={initial.is_active ? 'outline' : 'default'}
              size="sm"
              onClick={toggleActive}
              disabled={activePending}
            >
              {activePending ? '處理中…' : initial.is_active ? '停用帳號' : '重新啟用'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
