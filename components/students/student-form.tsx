'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import {
  CURRENT_DEGREE_VALUES,
  TARGET_COUNTRY_VALUES,
  TARGET_DEGREE_VALUES,
  studentBaseSchema,
  type StudentInput,
} from '@/lib/validators/student'

import type { ActionResult } from '@/app/(dashboard)/students/actions'

export type StudentFormProps = {
  mode: 'create' | 'edit'
  studentId?: string
  initialValues?: Partial<StudentInput>
  currentUserId: string
  currentUserRole: UserRole
  consultantOptions: Array<{ id: string; name: string }>
  referrerOptions: Array<{ id: string; name: string; type: string }>
  onSubmit: (input: StudentInput) => Promise<ActionResult>
}

const LEAD_SOURCE_OPTIONS = [
  { value: 'self_developed', label: '自行開發' },
  { value: 'marketing_dept', label: '行銷部分配' },
  { value: 'consultant_referral', label: '同事轉介' },
  { value: 'external_referrer', label: '外部轉介人' },
  { value: 'brand_introduction', label: '品牌介紹' },
  { value: 'other', label: '其他' },
] as const

const CURRENT_DEGREE_LABELS: Record<(typeof CURRENT_DEGREE_VALUES)[number], string> = {
  high_school: '高中',
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  other: '其他',
}

const TARGET_DEGREE_LABELS: Record<(typeof TARGET_DEGREE_VALUES)[number], string> = {
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  language: '語言學校',
  tour: '遊學團',
  other: '其他',
}

const TARGET_COUNTRY_LABELS: Record<(typeof TARGET_COUNTRY_VALUES)[number], string> = {
  US: '美國',
  UK: '英國',
  CA: '加拿大',
  AU: '澳洲',
  Other: '其他',
}

function defaultValuesFor(
  initial: Partial<StudentInput> | undefined,
  fallbackConsultantId: string,
): StudentInput {
  return {
    full_name: initial?.full_name ?? '',
    english_name: initial?.english_name ?? null,
    email: initial?.email ?? null,
    phone: initial?.phone ?? null,
    line_id: initial?.line_id ?? null,
    birth_date: initial?.birth_date ?? null,
    current_school: initial?.current_school ?? null,
    current_major: initial?.current_major ?? null,
    current_degree: initial?.current_degree ?? null,
    graduation_year: initial?.graduation_year ?? null,
    target_country: initial?.target_country ?? null,
    target_degree: initial?.target_degree ?? null,
    target_major: initial?.target_major ?? null,
    target_intake: initial?.target_intake ?? null,
    lead_source_type: initial?.lead_source_type ?? 'self_developed',
    lead_source_user_id: initial?.lead_source_user_id ?? null,
    lead_source_referrer_id: initial?.lead_source_referrer_id ?? null,
    lead_source_note: initial?.lead_source_note ?? null,
    frontend_consultant_id: initial?.frontend_consultant_id ?? fallbackConsultantId,
    notes: initial?.notes ?? null,
    tags: initial?.tags ?? null,
  }
}

export function StudentForm({
  mode,
  studentId,
  initialValues,
  currentUserId,
  currentUserRole,
  consultantOptions,
  referrerOptions,
  onSubmit,
}: StudentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canPickConsultant = isManagerOrAdmin(currentUserRole)

  const form = useForm<StudentInput>({
    resolver: zodResolver(studentBaseSchema),
    defaultValues: defaultValuesFor(initialValues, currentUserId),
  })

  const leadSourceType = form.watch('lead_source_type')
  const showInternalUserField =
    leadSourceType === 'marketing_dept' || leadSourceType === 'consultant_referral'
  const showReferrerField =
    leadSourceType === 'external_referrer' || leadSourceType === 'brand_introduction'

  // Clear the irrelevant field when type switches.
  useEffect(() => {
    if (!showInternalUserField) form.setValue('lead_source_user_id', null)
    if (!showReferrerField) form.setValue('lead_source_referrer_id', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadSourceType])

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await onSubmit(data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof StudentInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success(mode === 'create' ? '已建立學生' : '已更新')
      router.push(`/students/${result.id}`)
      router.refresh()
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本資料 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資料</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    中文姓名 <span className="text-destructive">*</span>
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
              name="english_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>英文姓名</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
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
              name="phone"
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
            <FormField
              control={form.control}
              name="line_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LINE ID</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>生日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 當前學歷 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">當前學歷</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="current_school"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>學校</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="current_major"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>科系</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="current_degree"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>學位</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                    value={field.value ?? '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">未填</SelectItem>
                      {CURRENT_DEGREE_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {CURRENT_DEGREE_LABELS[v]}
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
              name="graduation_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>畢業年份</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1980}
                      max={2050}
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
          </CardContent>
        </Card>

        {/* 申請目標 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">申請目標</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="target_country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目標國家(可複選)</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    {TARGET_COUNTRY_VALUES.map((c) => {
                      const checked = (field.value ?? []).includes(c)
                      return (
                        <label key={c} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(state) => {
                              const arr = field.value ?? []
                              if (state) {
                                field.onChange([...arr, c])
                              } else {
                                field.onChange(arr.filter((v) => v !== c))
                              }
                            }}
                          />
                          {TARGET_COUNTRY_LABELS[c]}
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="target_degree"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>申請學位</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">未填</SelectItem>
                        {TARGET_DEGREE_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {TARGET_DEGREE_LABELS[v]}
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
                name="target_intake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>入學期間</FormLabel>
                    <FormControl>
                      <Input placeholder="例:Fall 2026" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_major"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>申請科系</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例:Electrical Engineering"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 名單來源與顧問派發 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">名單來源 + 顧問派發</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="lead_source_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    名單來源 <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇來源" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAD_SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showInternalUserField ? (
              <FormField
                control={form.control}
                name="lead_source_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {leadSourceType === 'marketing_dept' ? '行銷部同事' : '介紹同事'}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇同事" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">尚未指定</SelectItem>
                        {consultantOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {showReferrerField ? (
              <FormField
                control={form.control}
                name="lead_source_referrer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {leadSourceType === 'brand_introduction' ? '介紹品牌' : '轉介人'}
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇轉介人" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">尚未指定</SelectItem>
                        {referrerOptions.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            尚無轉介人(請先到 設定 → 轉介人 新增)
                          </SelectItem>
                        ) : (
                          referrerOptions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="lead_source_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>來源備註</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {canPickConsultant ? (
              <FormField
                control={form.control}
                name="frontend_consultant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>前端顧問</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇顧問" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">尚未指派</SelectItem>
                        {consultantOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <p className="text-xs text-muted-foreground">前端顧問預設指派為你本人。</p>
            )}
          </CardContent>
        </Card>

        {/* 備註 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">備註</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea rows={4} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (mode === 'edit' && studentId) {
                router.push(`/students/${studentId}`)
              } else {
                router.push('/students')
              }
            }}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? '儲存中…' : mode === 'create' ? '建立學生' : '儲存變更'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
