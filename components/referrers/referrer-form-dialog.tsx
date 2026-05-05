'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  REFERRER_TYPE_LABELS,
  REFERRER_TYPE_VALUES,
  referrerSchema,
  type ReferrerInput,
} from '@/lib/validators/referrer'

import { createReferrer, updateReferrer } from '@/app/(dashboard)/settings/referrers/actions'

type ReferrerFormDialogProps = {
  mode: 'create' | 'edit'
  initial?: Partial<ReferrerInput> & { id?: string }
  trigger: React.ReactNode
}

export function ReferrerFormDialog({ mode, initial, trigger }: ReferrerFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<ReferrerInput>({
    resolver: zodResolver(referrerSchema),
    defaultValues: {
      name: initial?.name ?? '',
      type: initial?.type ?? 'individual',
      contact_email: initial?.contact_email ?? null,
      contact_phone: initial?.contact_phone ?? null,
      notes: initial?.notes ?? null,
      is_active: initial?.is_active ?? true,
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createReferrer(data)
          : await updateReferrer(initial?.id ?? '', data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof ReferrerInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success(mode === 'create' ? '已新增轉介人' : '已更新轉介人')
      setOpen(false)
      form.reset()
      router.refresh()
    })
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && mode === 'create') form.reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增轉介人' : '編輯轉介人'}</DialogTitle>
          <DialogDescription>
            外部轉介人(品牌、學校、個人介紹人等),不會登入系統,僅供記錄與績效拆分使用。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      名稱 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      類型 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REFERRER_TYPE_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {REFERRER_TYPE_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">啟用中</FormLabel>
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
                {pending ? '儲存中…' : mode === 'create' ? '新增' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
