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
import type { LeadSourceDetailField } from '@/lib/constants/lead-source'

export type LeadSourceInitial = {
  id: string
  code: string
  label_zh: string
  default_referrer_id: string | null
  sort_order: number
  is_active: boolean
  detail_field: LeadSourceDetailField
}

const DETAIL_FIELD_LABELS: Record<LeadSourceDetailField, string> = {
  none: '無(只有備註欄)',
  internal_user: '自己人(從同事下拉選)',
  referrer: '轉介人(從轉介人下拉選,可設預設值)',
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
  const [detailField, setDetailField] = useState<LeadSourceDetailField>(
    initial?.detail_field ?? 'none',
  )

  const reset = () => {
    setCode(initial?.code ?? '')
    setLabelZh(initial?.label_zh ?? '')
    setDefaultReferrerId(initial?.default_referrer_id ?? NONE)
    setSortOrder(String(initial?.sort_order ?? 0))
    setIsActive(initial?.is_active ?? true)
    setDetailField(initial?.detail_field ?? 'none')
  }

  const submit = () => {
    // Default referrer only meaningful for type='referrer'.
    const effectiveReferrerId =
      detailField === 'referrer' && defaultReferrerId !== NONE ? defaultReferrerId : null
    const input = {
      code: code.trim(),
      label_zh: labelZh.trim(),
      default_referrer_id: effectiveReferrerId,
      sort_order: Number(sortOrder || 0),
      detail_field: detailField,
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
            <Label>學生表單顯示的詳情欄位</Label>
            <Select
              value={detailField}
              onValueChange={(v) => setDetailField(v as LeadSourceDetailField)}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{DETAIL_FIELD_LABELS.none}</SelectItem>
                <SelectItem value="internal_user">{DETAIL_FIELD_LABELS.internal_user}</SelectItem>
                <SelectItem value="referrer">{DETAIL_FIELD_LABELS.referrer}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              選了「轉介人」才能設定下面的「預設轉介人」,並且學生表單會顯示轉介人下拉。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className={detailField === 'referrer' ? '' : 'text-muted-foreground'}>
              預設轉介人
            </Label>
            <Select
              value={defaultReferrerId}
              onValueChange={setDefaultReferrerId}
              disabled={pending || detailField !== 'referrer'}
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
            {detailField !== 'referrer' ? (
              <p className="text-xs text-muted-foreground">當前類型不適用,請改選「轉介人」類型。</p>
            ) : null}
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
