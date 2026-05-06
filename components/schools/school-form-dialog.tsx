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
import { COUNTRY_LABELS, COUNTRY_VALUES } from '@/lib/constants/school'
import { schoolSchema, type SchoolInput } from '@/lib/validators/school'

import { createSchool, updateSchool } from '@/app/(dashboard)/schools/actions'

type Props = {
  mode: 'create' | 'edit'
  initial?: Partial<SchoolInput> & { id?: string }
  trigger: React.ReactNode
}

export function SchoolFormDialog({ mode, initial, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<SchoolInput>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name_en: initial?.name_en ?? '',
      name_zh: initial?.name_zh ?? null,
      short_name: initial?.short_name ?? null,
      country: initial?.country ?? 'US',
      state_or_region: initial?.state_or_region ?? null,
      city: initial?.city ?? null,
      website: initial?.website ?? null,
      ranking_qs: initial?.ranking_qs ?? null,
      ranking_us_news: initial?.ranking_us_news ?? null,
      is_partner: initial?.is_partner ?? false,
      partner_commission_rate: initial?.partner_commission_rate ?? null,
      partner_notes: initial?.partner_notes ?? null,
      is_active: initial?.is_active ?? true,
    },
  })

  const isPartner = form.watch('is_partner')

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result =
        mode === 'create' ? await createSchool(data) : await updateSchool(initial?.id ?? '', data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof SchoolInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success(mode === 'create' ? '已新增學校' : '已更新學校')
      setOpen(false)
      router.refresh()
      if (mode === 'create' && result.ok) {
        router.push(`/schools/${result.id}`)
      }
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
          <DialogTitle>{mode === 'create' ? '新增學校' : '編輯學校'}</DialogTitle>
          <DialogDescription>
            學校資料是全公司共用,所有顧問都看得到。合作學校可填回傭率。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      英文名稱 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例:Massachusetts Institute of Technology"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name_zh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>中文名稱</FormLabel>
                    <FormControl>
                      <Input placeholder="例:麻省理工學院" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>簡稱</FormLabel>
                    <FormControl>
                      <Input placeholder="MIT" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      國家 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRY_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {COUNTRY_LABELS[c]}
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
                name="state_or_region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>州/區</FormLabel>
                    <FormControl>
                      <Input placeholder="例:MA" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>城市</FormLabel>
                    <FormControl>
                      <Input placeholder="例:Cambridge" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>官網</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ranking_qs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>QS Ranking</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
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
                name="ranking_us_news"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>US News Ranking</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
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
              name="is_partner"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">合作學校(會自動建立佣金紀錄)</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isPartner ? (
              <div className="grid grid-cols-1 gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="partner_commission_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>回傭率(%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
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
                  name="partner_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>合作備註</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

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
