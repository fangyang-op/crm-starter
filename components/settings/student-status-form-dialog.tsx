'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  COLOR_KEY_VALUES,
  STAGE_LABELS,
  statusBadgeClass,
  type StudentStatusStage,
} from '@/lib/constants/student-status'

import {
  createStudentStatus,
  updateStudentStatus,
} from '@/app/(dashboard)/settings/student-statuses/actions'

export type StudentStatusInitial = {
  id: string
  code: string
  label_zh: string
  category: StudentStatusStage
  color_key: string
  sort_order: number
  is_active: boolean
}

type Props = {
  mode: 'create' | 'edit'
  initial?: StudentStatusInitial
  trigger: React.ReactNode
}

const STAGE_VALUES: StudentStatusStage[] = ['recruitment', 'closed', 'application', 'special']

export function StudentStatusFormDialog({ mode, initial, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [code, setCode] = useState(initial?.code ?? '')
  const [labelZh, setLabelZh] = useState(initial?.label_zh ?? '')
  const [category, setCategory] = useState<StudentStatusStage>(initial?.category ?? 'recruitment')
  const [colorKey, setColorKey] = useState(initial?.color_key ?? 'slate')
  const [sortOrder, setSortOrder] = useState<string>(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const reset = () => {
    setCode(initial?.code ?? '')
    setLabelZh(initial?.label_zh ?? '')
    setCategory(initial?.category ?? 'recruitment')
    setColorKey(initial?.color_key ?? 'slate')
    setSortOrder(String(initial?.sort_order ?? 0))
    setIsActive(initial?.is_active ?? true)
  }

  const submit = () => {
    const input = {
      code: code.trim(),
      label_zh: labelZh.trim(),
      category,
      color_key: colorKey,
      sort_order: Number(sortOrder || 0),
    }

    startTransition(async () => {
      const r =
        mode === 'create'
          ? await createStudentStatus(input)
          : await updateStudentStatus(initial!.id, { ...input, is_active: isActive })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(mode === 'create' ? '已建立' : '已更新')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增學生狀態' : '編輯學生狀態'}</DialogTitle>
          <DialogDescription>
            代號是內部使用,中文名稱會顯示在學生卡片與篩選器。停用後不會再列在新建學生的下拉選單裡,但歷史學生仍保留該狀態。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">代號</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例:onboarding_v2"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">英數與底線,以字母開頭。</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label-zh">中文名稱</Label>
              <Input
                id="label-zh"
                value={labelZh}
                onChange={(e) => setLabelZh(e.target.value)}
                placeholder="例:資料準備"
                disabled={pending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>分類</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as StudentStatusStage)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sort-order">顯示順序</Label>
              <NumberInput
                id="sort-order"
                decimal={false}
                value={sortOrder}
                onValueChange={setSortOrder}
                placeholder="0"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">數字越小越前面。</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>顏色</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_KEY_VALUES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setColorKey(k)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-shadow',
                    statusBadgeClass(k),
                    colorKey === k ? 'ring-2 ring-ring' : '',
                  )}
                  disabled={pending}
                >
                  {k}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              預覽:
              <span
                className={cn(
                  'ml-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
                  statusBadgeClass(colorKey),
                )}
              >
                {labelZh || '範例'}
              </span>
            </p>
          </div>

          {mode === 'edit' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={pending}
              />
              啟用中
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '儲存中…' : mode === 'create' ? '建立' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
