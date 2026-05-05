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
import { Textarea } from '@/components/ui/textarea'
import {
  PLAN_COUNTRY_VALUES,
  PLAN_DEGREE_VALUES,
  planSchema,
  type PlanInput,
} from '@/lib/validators/plan'

import { createServicePlan, updateServicePlan } from '@/app/(dashboard)/settings/plans/actions'

const COUNTRY_LABELS: Record<(typeof PLAN_COUNTRY_VALUES)[number], string> = {
  US: '美國',
  UK: '英國',
  CA: '加拿大',
  AU: '澳洲',
  Other: '其他',
}

const DEGREE_LABELS: Record<(typeof PLAN_DEGREE_VALUES)[number], string> = {
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  language: '語言學校',
  tour: '遊學團',
  other: '其他',
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Partial<PlanInput> & { id?: string }
  trigger: React.ReactNode
}

export function PlanFormDialog({ mode, initial, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      description: initial?.description ?? null,
      base_price: initial?.base_price ?? 0,
      currency: initial?.currency ?? 'TWD',
      included_school_count: initial?.included_school_count ?? null,
      included_word_quota: initial?.included_word_quota ?? null,
      scope_country: initial?.scope_country ?? null,
      scope_degree: initial?.scope_degree ?? null,
      is_active: initial?.is_active ?? true,
      display_order: initial?.display_order ?? 0,
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createServicePlan(data)
          : await updateServicePlan(initial?.id ?? '', data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof PlanInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success(mode === 'create' ? '已新增方案' : '已更新方案')
      setOpen(false)
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增方案' : '編輯方案'}</DialogTitle>
          <DialogDescription>服務方案會在學生「建立成交」時被選用。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      代碼 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="例:US-MASTER-10" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      名稱 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="例:美碩 10 校旗艦" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>說明</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      基礎價格 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>幣別</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? 'TWD'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>顯示順序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="included_school_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>含學校數</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="included_word_quota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>含字數</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="scope_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>適用國家(可複選)</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {PLAN_COUNTRY_VALUES.map((c) => {
                      const checked = (field.value ?? []).includes(c)
                      return (
                        <label key={c} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              const arr = field.value ?? []
                              field.onChange(state ? [...arr, c] : arr.filter((v) => v !== c))
                            }}
                          />
                          {COUNTRY_LABELS[c]}
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scope_degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>適用學位(可複選)</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {PLAN_DEGREE_VALUES.map((d) => {
                      const checked = (field.value ?? []).includes(d)
                      return (
                        <label key={d} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              const arr = field.value ?? []
                              field.onChange(state ? [...arr, d] : arr.filter((v) => v !== d))
                            }}
                          />
                          {DEGREE_LABELS[d]}
                        </label>
                      )
                    })}
                  </div>
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
