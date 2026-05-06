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

import { createLeadSource, updateLeadSource } from '@/app/(dashboard)/settings/lead-sources/actions'

export type LeadSourceInitial = {
  id: string
  code: string
  label_zh: string
  default_referrer_id: string | null
  sort_order: number
  is_active: boolean
}

type ReferrerOption = { id: string; name: string }

type Props = {
  mode: 'create' | 'edit'
  initial?: LeadSourceInitial
  referrers: ReferrerOption[]
  trigger: React.ReactNode
}

const NONE = '__none__'

export function LeadSourceFormDialog({ mode, initial, referrers, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [code, setCode] = useState(initial?.code ?? '')
  const [labelZh, setLabelZh] = useState(initial?.label_zh ?? '')
  const [defaultReferrerId, setDefaultReferrerId] = useState<string>(
    initial?.default_referrer_id ?? NONE,
  )
  const [sortOrder, setSortOrder] = useState<string>(String(initial?.sort_order ?? 0))
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const reset = () => {
    setCode(initial?.code ?? '')
    setLabelZh(initial?.label_zh ?? '')
    setDefaultReferrerId(initial?.default_referrer_id ?? NONE)
    setSortOrder(String(initial?.sort_order ?? 0))
    setIsActive(initial?.is_active ?? true)
  }

  const submit = () => {
    const input = {
      code: code.trim(),
      label_zh: labelZh.trim(),
      default_referrer_id: defaultReferrerId === NONE ? null : defaultReferrerId,
      sort_order: Number(sortOrder || 0),
    }

    startTransition(async () => {
      const r =
        mode === 'create'
          ? await createLeadSource(input)
          : await updateLeadSource(initial!.id, { ...input, is_active: isActive })
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
          <DialogTitle>{mode === 'create' ? '新增名單來源' : '編輯名單來源'}</DialogTitle>
          <DialogDescription>
            代號是內部使用,中文名稱會顯示在學生表單。停用後不會再列在新建學生的下拉選單裡,但歷史學生仍保留來源。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">代號</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例:partner_school"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              英數與底線,以字母開頭。建立後不建議再改。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label-zh">中文名稱</Label>
            <Input
              id="label-zh"
              value={labelZh}
              onChange={(e) => setLabelZh(e.target.value)}
              placeholder="例:合作學校轉介"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>預設轉介人</Label>
            <Select
              value={defaultReferrerId}
              onValueChange={setDefaultReferrerId}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue placeholder="未指定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>未指定</SelectItem>
                {referrers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
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
