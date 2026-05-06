'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  WORD_QUOTA_TX_COLOR,
  WORD_QUOTA_TX_LABELS,
  type WordQuotaTransactionType,
} from '@/lib/constants/word-quota'

import { addWordQuotaBonus } from '@/app/(dashboard)/students/[id]/word-quota/actions'

export type LedgerEntry = {
  id: string
  transaction_type: WordQuotaTransactionType
  amount: number
  balance_after: number
  description: string
  created_at: string
  created_by_name: string | null
}

type Props = {
  studentId: string
  studentName: string
  balance: number
  entries: LedgerEntry[]
  canAddBonus: boolean
  trigger: React.ReactNode
}

export function WordQuotaLedgerSheet({
  studentId,
  studentName,
  balance,
  entries,
  canAddBonus,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const totalAdded = entries.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0)
  const totalUsed = entries.filter((e) => e.amount < 0).reduce((sum, e) => sum + e.amount, 0)

  const handleBonus = () => {
    const n = Number(amount)
    if (!Number.isInteger(n) || n <= 0) {
      toast.error('加碼數量必須是正整數')
      return
    }
    if (!description.trim()) {
      toast.error('請填寫加碼原因')
      return
    }
    startTransition(async () => {
      const r = await addWordQuotaBonus({
        student_id: studentId,
        amount: n,
        description: description.trim(),
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`已加碼 ${n.toLocaleString('zh-TW')} 字`)
      setAmount('')
      setDescription('')
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>字數帳本 — {studentName}</SheetTitle>
          <SheetDescription>學生字數使用紀錄(append-only,無法編輯或刪除)。</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">餘額</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {balance.toLocaleString('zh-TW')}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">累計加值</p>
              <p className="text-base font-semibold tabular-nums text-emerald-700">
                +{totalAdded.toLocaleString('zh-TW')}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">累計使用</p>
              <p className="text-base font-semibold tabular-nums text-destructive">
                {totalUsed.toLocaleString('zh-TW')}
              </p>
            </div>
          </div>

          {canAddBonus ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">加碼字數</p>
              <p className="text-xs text-muted-foreground">
                由前端顧問或主管決策的「養字」獎勵,正數,記入帳本 type=bonus。
              </p>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bonus-amount" className="text-xs">
                    數量
                  </Label>
                  <Input
                    id="bonus-amount"
                    type="number"
                    min={1}
                    step={500}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="3000"
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bonus-desc" className="text-xs">
                    原因 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bonus-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="例:推薦學弟妹獎勵"
                    disabled={pending}
                  />
                </div>
              </div>
              <Button onClick={handleBonus} disabled={pending} className="w-full">
                <Plus size={14} className="mr-1" />
                {pending ? '加碼中…' : '確認加碼'}
              </Button>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="text-sm font-medium">明細(時間倒序)</p>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無紀錄。</p>
            ) : (
              <ol className="space-y-1.5">
                {entries.map((e) => {
                  const sign = e.amount > 0 ? '+' : ''
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {WORD_QUOTA_TX_LABELS[e.transaction_type]}
                          </Badge>
                          <span className="truncate">{e.description}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleString('zh-TW', {
                            timeZone: 'Asia/Taipei',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {e.created_by_name ? ` · ${e.created_by_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-semibold tabular-nums',
                            WORD_QUOTA_TX_COLOR[e.transaction_type],
                          )}
                        >
                          {sign}
                          {e.amount.toLocaleString('zh-TW')}
                        </p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          餘 {e.balance_after.toLocaleString('zh-TW')}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
