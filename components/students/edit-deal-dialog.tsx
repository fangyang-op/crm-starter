'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PAYMENT_STATUS_VALUES, dealEditSchema, type DealEditInput } from '@/lib/validators/deal'

import { updateDeal } from '@/app/(dashboard)/students/[id]/deals/actions'

const PAYMENT_STATUS_LABELS: Record<(typeof PAYMENT_STATUS_VALUES)[number], string> = {
  pending: '未收',
  partial: '部分',
  paid: '已付清',
}

type Props = {
  dealId: string
  studentId: string
  initial: DealEditInput
  trigger: React.ReactNode
}

export function EditDealDialog({ dealId, studentId, initial, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<DealEditInput>({
    resolver: zodResolver(dealEditSchema),
    defaultValues: {
      signed_at: initial.signed_at,
      contract_no: initial.contract_no ?? null,
      payment_status: initial.payment_status,
      discount_reason: initial.discount_reason ?? null,
      notes: initial.notes ?? null,
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await updateDeal(dealId, studentId, data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof DealEditInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success('已更新成交')
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          form.reset({
            signed_at: initial.signed_at,
            contract_no: initial.contract_no ?? null,
            payment_status: initial.payment_status,
            discount_reason: initial.discount_reason ?? null,
            notes: initial.notes ?? null,
          })
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>編輯成交</DialogTitle>
          <DialogDescription>
            僅可編輯不影響金額的欄位。要改方案 / 加購 / 拆分請與管理員聯繫(目前需重建一筆)。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="signed_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      簽約日 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款狀態</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PAYMENT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="contract_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>合約編號</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discount_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>優惠原因</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? '儲存中…' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
