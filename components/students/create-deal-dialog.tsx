'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

import { createDeal } from '@/app/(dashboard)/students/[id]/deals/actions'
import {
  PAYMENT_STATUS_VALUES,
  SPLIT_ROLE_LABELS,
  type DealSplitInput,
} from '@/lib/validators/deal'

type PlanOption = {
  id: string
  code: string
  name: string
  base_price: number
  currency: string
  included_school_count: number | null
  included_word_quota: number | null
  is_active: boolean
}

type ConsultantOption = { id: string; name: string }
type ReferrerOption = { id: string; name: string }

type Props = {
  studentId: string
  studentName: string
  defaultConsultantId: string | null
  plans: PlanOption[]
  consultants: ConsultantOption[]
  referrers: ReferrerOption[]
  extraSchoolPrice: number
  extraWordPricePer1000: number
  trigger: React.ReactNode
}

const PAYMENT_STATUS_LABELS: Record<(typeof PAYMENT_STATUS_VALUES)[number], string> = {
  pending: '未收',
  partial: '部分',
  paid: '已付清',
}

function todayInTaipei(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export function CreateDealDialog({
  studentId,
  studentName,
  defaultConsultantId,
  plans,
  consultants,
  referrers,
  extraSchoolPrice,
  extraWordPricePer1000,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Form state — managed by useState because react-hook-form's array controls
  // make the splits UX harder to read. We validate on submit via server action.
  const [planId, setPlanId] = useState<string>('')
  const [extraSchool, setExtraSchool] = useState(0)
  const [extraWord, setExtraWord] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [signedAt, setSignedAt] = useState(todayInTaipei())
  const [contractNo, setContractNo] = useState('')
  const [paymentStatus, setPaymentStatus] =
    useState<(typeof PAYMENT_STATUS_VALUES)[number]>('pending')
  const [notes, setNotes] = useState('')

  const [hasReferrer, setHasReferrer] = useState(false)
  const [primaryUserId, setPrimaryUserId] = useState<string>(defaultConsultantId ?? '')
  const [primaryPct, setPrimaryPct] = useState(100)
  const [referrerType, setReferrerType] = useState<'user' | 'referrer'>('referrer')
  const [referrerUserId, setReferrerUserId] = useState<string>('')
  const [referrerReferrerId, setReferrerReferrerId] = useState<string>('')
  const [referrerPct, setReferrerPct] = useState(0)
  type BonusRow = { id: string; userId: string; percentage: number; notes: string }
  const [bonusRows, setBonusRows] = useState<BonusRow[]>([])

  const reset = () => {
    setPlanId('')
    setExtraSchool(0)
    setExtraWord(0)
    setDiscount(0)
    setDiscountReason('')
    setSignedAt(todayInTaipei())
    setContractNo('')
    setPaymentStatus('pending')
    setNotes('')
    setHasReferrer(false)
    setPrimaryUserId(defaultConsultantId ?? '')
    setPrimaryPct(100)
    setReferrerType('referrer')
    setReferrerUserId('')
    setReferrerReferrerId('')
    setReferrerPct(0)
    setBonusRows([])
  }

  // When toggling "有轉介人?", default to 65/35 split.
  useEffect(() => {
    if (hasReferrer) {
      setPrimaryPct(65)
      setReferrerPct(35)
    } else {
      setPrimaryPct(100)
      setReferrerPct(0)
      setReferrerUserId('')
      setReferrerReferrerId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasReferrer])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId])

  const computed = useMemo(() => {
    const base = selectedPlan?.base_price ?? 0
    const addon = extraSchool * extraSchoolPrice + (extraWord / 1000) * extraWordPricePer1000
    const final = base + addon - discount
    return { base, addon, final, currency: selectedPlan?.currency ?? 'TWD' }
  }, [selectedPlan, extraSchool, extraWord, extraSchoolPrice, extraWordPricePer1000, discount])

  const mainTotal = primaryPct + (hasReferrer ? referrerPct : 0)
  const mainTotalOk = Math.abs(mainTotal - 100) < 0.01

  const handleSubmit = () => {
    if (!planId) {
      toast.error('請選擇方案')
      return
    }
    if (!mainTotalOk) {
      toast.error(`主拆分加總須為 100%(目前 ${mainTotal}%)`)
      return
    }
    if (!primaryUserId) {
      toast.error('請選擇主要顧問')
      return
    }
    if (hasReferrer) {
      if (referrerType === 'user' && !referrerUserId) {
        toast.error('請選擇轉介同事')
        return
      }
      if (referrerType === 'referrer' && !referrerReferrerId) {
        toast.error('請選擇轉介人')
        return
      }
    }

    const splits: DealSplitInput[] = [
      {
        role_in_deal: 'primary_consultant',
        recipient_user_id: primaryUserId,
        recipient_referrer_id: null,
        percentage: primaryPct,
        notes: null,
      },
    ]
    if (hasReferrer) {
      splits.push({
        role_in_deal: 'referrer',
        recipient_user_id: referrerType === 'user' ? referrerUserId : null,
        recipient_referrer_id: referrerType === 'referrer' ? referrerReferrerId : null,
        percentage: referrerPct,
        notes: null,
      })
    }
    for (const b of bonusRows) {
      if (!b.userId) {
        toast.error('主管獎金缺少對象')
        return
      }
      splits.push({
        role_in_deal: 'manager_bonus',
        recipient_user_id: b.userId,
        recipient_referrer_id: null,
        percentage: b.percentage,
        notes: b.notes || null,
      })
    }

    startTransition(async () => {
      const result = await createDeal({
        student_id: studentId,
        plan_id: planId,
        extra_school_count: extraSchool,
        extra_word_quota: extraWord,
        discount_amount: discount,
        discount_reason: discountReason || null,
        signed_at: signedAt,
        contract_no: contractNo || null,
        payment_status: paymentStatus,
        notes: notes || null,
        splits,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('成交建立成功')
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>建立成交 — {studentName}</SheetTitle>
          <SheetDescription>
            金額由伺服器以方案 + 加購單價計算為準,UI 顯示僅為預覽。
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Plan */}
          <div className="space-y-2">
            <Label>
              方案 <span className="text-destructive">*</span>
            </Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇方案" />
              </SelectTrigger>
              <SelectContent>
                {plans.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    尚無啟用中的方案 — 請先到 設定 → 服務方案 新增
                  </SelectItem>
                ) : (
                  plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      [{p.code}] {p.name} — {p.currency} {p.base_price.toLocaleString('zh-TW')}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedPlan ? (
            <Card>
              <CardContent className="grid grid-cols-2 gap-2 pt-4 text-xs text-muted-foreground">
                <span>方案內含學校</span>
                <span className="tabular-nums text-foreground">
                  {selectedPlan.included_school_count ?? '不限'}
                </span>
                <span>方案內含字數</span>
                <span className="tabular-nums text-foreground">
                  {selectedPlan.included_word_quota?.toLocaleString('zh-TW') ?? '無'}
                </span>
              </CardContent>
            </Card>
          ) : null}

          {/* Addons */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="extra-school">加購學校數</Label>
              <Input
                id="extra-school"
                type="number"
                min={0}
                value={extraSchool}
                onChange={(e) => setExtraSchool(Math.max(0, Number(e.target.value || 0)))}
              />
              <p className="text-xs text-muted-foreground">
                單價 {extraSchoolPrice.toLocaleString('zh-TW')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-word">加購字數</Label>
              <Input
                id="extra-word"
                type="number"
                min={0}
                step={1000}
                value={extraWord}
                onChange={(e) => setExtraWord(Math.max(0, Number(e.target.value || 0)))}
              />
              <p className="text-xs text-muted-foreground">
                每 1000 字 {extraWordPricePer1000.toLocaleString('zh-TW')}
              </p>
            </div>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="discount">優惠金額</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value || 0)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-reason">優惠原因</Label>
              <Input
                id="discount-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            </div>
          </div>

          {/* Final summary */}
          <Card>
            <CardContent className="space-y-1.5 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">基礎</span>
                <span className="tabular-nums">
                  {computed.currency} {computed.base.toLocaleString('zh-TW')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">加購</span>
                <span className="tabular-nums">
                  + {computed.currency} {computed.addon.toLocaleString('zh-TW')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">優惠</span>
                <span className="tabular-nums">
                  − {computed.currency} {discount.toLocaleString('zh-TW')}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-medium">最終金額</span>
                  <span className="text-xl font-bold tabular-nums">
                    {computed.currency} {computed.final.toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contract */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signed-at">
                簽約日 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signed-at"
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-no">合約編號</Label>
              <Input
                id="contract-no"
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>付款狀態</Label>
              <Select
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as typeof paymentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Splits */}
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">績效拆分</div>
              <div className="text-xs text-muted-foreground">
                主拆分總和{' '}
                <span className={mainTotalOk ? 'text-emerald-600' : 'text-destructive'}>
                  {mainTotal}%
                </span>
              </div>
            </div>

            {/* Primary consultant row */}
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {SPLIT_ROLE_LABELS.primary_consultant}
                </Label>
                <Select value={primaryUserId} onValueChange={setPrimaryUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">%</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={primaryPct}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value || 0)))
                    setPrimaryPct(v)
                    if (hasReferrer) setReferrerPct(100 - v)
                  }}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasReferrer} onCheckedChange={(v) => setHasReferrer(Boolean(v))} />
              有轉介人
            </label>

            {hasReferrer ? (
              <div className="space-y-2 rounded-md bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={referrerType === 'referrer' ? 'default' : 'outline'}
                    onClick={() => setReferrerType('referrer')}
                  >
                    外部轉介人
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={referrerType === 'user' ? 'default' : 'outline'}
                    onClick={() => setReferrerType('user')}
                  >
                    內部同事
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <div>
                    {referrerType === 'referrer' ? (
                      <Select value={referrerReferrerId} onValueChange={setReferrerReferrerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇轉介人" />
                        </SelectTrigger>
                        <SelectContent>
                          {referrers.length === 0 ? (
                            <SelectItem value="__empty__" disabled>
                              尚無轉介人(請先到 設定 → 轉介人 新增)
                            </SelectItem>
                          ) : (
                            referrers.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={referrerUserId} onValueChange={setReferrerUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇同事" />
                        </SelectTrigger>
                        <SelectContent>
                          {consultants.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={referrerPct}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value || 0)))
                      setReferrerPct(v)
                      setPrimaryPct(100 - v)
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Manager bonuses */}
            {bonusRows.map((b, idx) => (
              <div key={b.id} className="grid grid-cols-[1fr_100px_36px] items-end gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {SPLIT_ROLE_LABELS.manager_bonus}
                  </Label>
                  <Select
                    value={b.userId}
                    onValueChange={(v) =>
                      setBonusRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, userId: v } : r)),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">%(額外)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={b.percentage}
                    onChange={(e) =>
                      setBonusRows((rows) =>
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, percentage: Math.max(0, Number(e.target.value || 0)) }
                            : r,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setBonusRows((rows) => rows.filter((_, i) => i !== idx))}
                  aria-label="移除"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setBonusRows((rows) => [
                  ...rows,
                  { id: crypto.randomUUID(), userId: '', percentage: 5, notes: '' },
                ])
              }
            >
              <Plus size={14} className="mr-1" />
              新增主管獎金
            </Button>
            <p className="text-xs text-muted-foreground">
              主管獎金為「額外」獎金,不計入主拆分 100% 總和。
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">備註</Label>
            <Textarea
              id="deal-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? '建立中…' : '建立成交'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
