'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
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

import {
  checkContactPhoneDuplicate,
  checkPhoneDuplicate,
  type ActionResult,
  type ContactPhoneMatch,
  type DuplicateOverride,
  type DuplicatePhoneStudent,
  type PreliminaryScoreInput,
} from '@/app/(dashboard)/students/actions'
import {
  addStudentContact,
  type ContactRelation,
} from '@/app/(dashboard)/students/[id]/contacts/actions'

export type LeadSourceOption = {
  id: string
  code: string
  label_zh: string
  detail_field: 'none' | 'internal_user' | 'referrer'
  default_referrer_id: string | null
}

export type StudentFormProps = {
  mode: 'create' | 'edit'
  studentId?: string
  initialValues?: Partial<StudentInput>
  currentUserId: string
  currentUserRole: UserRole
  /** Used for the lead_source_user_id picker (any internal staff). */
  consultantOptions: Array<{ id: string; name: string }>
  /** Filtered to people whose department='frontend' (incl. admin if set). */
  frontendConsultantOptions: Array<{ id: string; name: string }>
  /** Filtered to people whose department='backend' (incl. admin if set). */
  backendConsultantOptions: Array<{ id: string; name: string }>
  referrerOptions: Array<{ id: string; name: string; type: string }>
  leadSourceOptions: LeadSourceOption[]
  onSubmit: (
    input: StudentInput,
    preliminaryScores?: PreliminaryScoreInput[],
    duplicateOverride?: DuplicateOverride | null,
  ) => Promise<ActionResult>
}

// v1.1 §2: values are already the display labels — no separate label map needed.

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

// Stage 2-A 最小揭露 — consultant 看不到對方身分時顯示的通用訊息。正常情況
// 由 RPC(0045)回傳同字串;此為後援,確保即使後端漏帶也不會 fall back 成空白。
const DUP_NOTICE_FALLBACK = '此聯繫方式已存在,請聯繫管理員或主管'

function defaultValuesFor(
  initial: Partial<StudentInput> | undefined,
  fallbackConsultantId: string,
  fallbackLeadSourceId: string,
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
    lead_source_id: initial?.lead_source_id ?? fallbackLeadSourceId,
    lead_source_user_id: initial?.lead_source_user_id ?? null,
    lead_source_referrer_id: initial?.lead_source_referrer_id ?? null,
    lead_source_note: initial?.lead_source_note ?? null,
    frontend_consultant_id: initial?.frontend_consultant_id ?? fallbackConsultantId,
    backend_consultant_id: initial?.backend_consultant_id ?? null,
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
  frontendConsultantOptions,
  backendConsultantOptions,
  referrerOptions,
  leadSourceOptions,
  onSubmit,
}: StudentFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canPickConsultant = isManagerOrAdmin(currentUserRole)

  // Default lead source: prefer 'self_developed' (the historical default),
  // else first active option, else first option, else empty.
  const fallbackLeadSourceId =
    leadSourceOptions.find((o) => o.code === 'self_developed')?.id ?? leadSourceOptions[0]?.id ?? ''

  const form = useForm<StudentInput>({
    resolver: zodResolver(studentBaseSchema),
    defaultValues: defaultValuesFor(initialValues, currentUserId, fallbackLeadSourceId),
  })

  // Preliminary scores section — only rendered in create mode. Front-end
  // consultants jot down what they know; back-end consultants take over for
  // detail / certificate / dates. All fields optional.
  const [prelimGpa, setPrelimGpa] = useState('')
  const [prelimEngType, setPrelimEngType] = useState<'none' | 'toefl' | 'ielts' | 'duolingo'>(
    'none',
  )
  const [prelimEngScore, setPrelimEngScore] = useState('')
  const [prelimStdType, setPrelimStdType] = useState<'none' | 'gre' | 'gmat' | 'sat'>('none')
  const [prelimStdScore, setPrelimStdScore] = useState('')

  // duplicate-prevention §3B: optional 代填人 capture during 新增. Default
  // 'self' = 學生本人,parent fields stay hidden. Switching to 'parent'
  // expands a small block we POST after the student insert succeeds (see
  // student_contacts INSERT in handleSubmit). Edit mode skips this entirely
  // — contact CRUD lives on the detail page.
  const [fillerType, setFillerType] = useState<'self' | 'parent'>('self')
  const [contactRelation, setContactRelation] = useState<ContactRelation>('母親')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  // phone-normalize §3: contact-phone has its own duplicate-detection path
  // — the SD function find_phone_anywhere queries students AND
  // student_contacts so the warning explicitly tells the consultant whether
  // the number is on a student or another contact.
  const [contactPhoneMatches, setContactPhoneMatches] = useState<ContactPhoneMatch[]>([])
  // Stage 2-A — consultant 不會拿到 matches,改收 message;以獨立 state 呈現。
  const [contactPhoneNotice, setContactPhoneNotice] = useState<string | null>(null)
  const [ignoreContactPhoneDup, setIgnoreContactPhoneDup] = useState(false)
  const [checkingContactPhone, setCheckingContactPhone] = useState(false)

  const handleContactPhoneBlur = async (value: string) => {
    const trimmed = (value ?? '').trim()
    if (trimmed.length < 8) {
      setContactPhoneMatches([])
      setContactPhoneNotice(null)
      return
    }
    setCheckingContactPhone(true)
    try {
      const r = await checkContactPhoneDuplicate(trimmed)
      if (r.ok && r.isDuplicate) {
        // 0045:manager/admin 拿到 matches(完整);consultant 只拿到 message。
        if (r.matches.length > 0) {
          setContactPhoneMatches(r.matches)
          setContactPhoneNotice(null)
        } else {
          setContactPhoneMatches([])
          setContactPhoneNotice(r.message ?? DUP_NOTICE_FALLBACK)
        }
        setIgnoreContactPhoneDup(false)
      } else {
        setContactPhoneMatches([])
        setContactPhoneNotice(null)
      }
    } finally {
      setCheckingContactPhone(false)
    }
  }

  // duplicate-prevention §2A: blur the phone field → server checks via SD
  // function find_duplicate_student_by_phone (0038). If a row comes back we
  // render an inline amber warning. The consultant can either jump to the
  // existing student or click「確認為不同學生,繼續建立」which flips
  // ignoreDuplicate and unblocks submit. Only relevant in create mode.
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicatePhoneStudent | null>(null)
  // Stage 2-A — consultant 不會拿到 existingStudent,改收 message;獨立 state 呈現。
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null)
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const initialPhone = initialValues?.phone ?? null

  const handlePhoneBlur = async (value: string) => {
    if (mode !== 'create') return
    const trimmed = (value ?? '').trim()
    if (trimmed.length < 8) {
      setDuplicateWarning(null)
      setDuplicateNotice(null)
      return
    }
    setCheckingDuplicate(true)
    try {
      const r = await checkPhoneDuplicate(trimmed)
      if (r.ok && r.isDuplicate) {
        // 0045:manager/admin 拿到 existingStudent(完整);consultant 只拿到 message。
        if (r.existingStudent) {
          setDuplicateWarning(r.existingStudent)
          setDuplicateNotice(null)
        } else {
          setDuplicateWarning(null)
          setDuplicateNotice(r.message ?? DUP_NOTICE_FALLBACK)
        }
        // New duplicate → reset the consultant's previous override so they
        // have to acknowledge again (avoids accidental ignore-once-then-edit).
        setIgnoreDuplicate(false)
      } else {
        setDuplicateWarning(null)
        setDuplicateNotice(null)
      }
    } finally {
      setCheckingDuplicate(false)
    }
  }

  const leadSourceId = form.watch('lead_source_id')
  const currentSource = leadSourceOptions.find((o) => o.id === leadSourceId)
  const currentCode = currentSource?.code
  const detailField = currentSource?.detail_field ?? 'none'
  const showInternalUserField = detailField === 'internal_user'
  const showReferrerField = detailField === 'referrer'

  // Clear the irrelevant field when source switches; if the new source has
  // a default referrer (only meaningful for type='referrer'), prefill it
  // unless the form already has a non-null value.
  useEffect(() => {
    if (!showInternalUserField) form.setValue('lead_source_user_id', null)
    if (!showReferrerField) {
      form.setValue('lead_source_referrer_id', null)
    } else if (currentSource?.default_referrer_id && !form.getValues('lead_source_referrer_id')) {
      form.setValue('lead_source_referrer_id', currentSource.default_referrer_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadSourceId])

  const buildPreliminaryScores = (): PreliminaryScoreInput[] => {
    if (mode !== 'create') return []
    const out: PreliminaryScoreInput[] = []
    if (prelimGpa.trim()) {
      out.push({ score_type: 'gpa', total_score: prelimGpa.trim() })
    }
    if (prelimEngType !== 'none' && prelimEngScore.trim()) {
      out.push({ score_type: prelimEngType, total_score: prelimEngScore.trim() })
    }
    if (prelimStdType !== 'none' && prelimStdScore.trim()) {
      out.push({ score_type: prelimStdType, total_score: prelimStdScore.trim() })
    }
    return out
  }

  const handleSubmit = form.handleSubmit((data) => {
    // §2A — block submit while a duplicate is detected and not yet
    // confirmed. manager/admin must explicitly press「確認為不同學生」first.
    if (mode === 'create' && duplicateWarning && !ignoreDuplicate) {
      toast.error('請先確認重複名單的處理方式')
      return
    }

    // Stage 2-A — consultant(最小揭露):看不到對方身分、無自助覆寫,一律
    // 擋下並提示聯繫主管。對應任務三(i)(已定案):顧問不可自助覆寫。後端
    // createStudent 也會依角色降級 override + 以 DUPLICATE_PHONE 擋(縱深防禦),
    // 此處只是即時 UX。
    if (mode === 'create' && duplicateNotice) {
      toast.error(duplicateNotice)
      return
    }

    // phone-normalize §3 — block submit if contact-phone duplicate is
    // pending acknowledgement. Same UX pattern as §2A.
    if (
      mode === 'create' &&
      fillerType === 'parent' &&
      contactPhoneMatches.length > 0 &&
      !ignoreContactPhoneDup
    ) {
      toast.error('請先確認代填人手機的重複處理方式')
      return
    }

    // Stage 2-A — consultant:代填人手機重複為提示性(無後端硬擋),隱藏身分
    // 後仍要求確認才繼續,與 manager 行為對齊。
    if (
      mode === 'create' &&
      fillerType === 'parent' &&
      contactPhoneNotice &&
      !ignoreContactPhoneDup
    ) {
      toast.error('請先確認代填人手機的重複處理方式')
      return
    }

    const scores = buildPreliminaryScores()
    const override: DuplicateOverride | null =
      mode === 'create' && duplicateWarning && ignoreDuplicate
        ? {
            duplicateOfStudentId: duplicateWarning.id,
            phone: (data.phone ?? '').trim(),
          }
        : null

    startTransition(async () => {
      const result = await onSubmit(data, scores.length > 0 ? scores : undefined, override)
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
        // §5 fallback: race / direct-API-bypass case — DB UNIQUE caught it
        // even though the inline check didn't. Re-trigger the check so the
        // amber warning renders instead of the bare toast.
        if (result.code === 'DUPLICATE_PHONE') {
          await handlePhoneBlur(data.phone ?? '')
        }
        return
      }
      // §3B: when 家長代填 is selected and a name was filled, attach a
      // contact row to the freshly-created student. Best-effort — the
      // student already exists, so a failed contact insert just surfaces
      // a warning toast and the consultant can re-add from the detail page.
      if (mode === 'create' && fillerType === 'parent' && contactName.trim()) {
        const cr = await addStudentContact(result.id, {
          relation: contactRelation,
          name: contactName.trim(),
          phone: contactPhone.trim() || null,
          email: contactEmail.trim() || null,
          line_id: null,
          is_primary_contact: true,
          notes: null,
        })
        if (!cr.ok) {
          toast.warning(`學生已建立,但代填人資料寫入失敗:${cr.error}`)
        }
      }

      toast.success(mode === 'create' ? '已建立學生' : '已更新')
      router.push(`/students/${result.id}`)
      router.refresh()
    })
  })

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 填寫人身份 — only for create mode. Edit mode reaches this form
            from the existing student's edit page; contact CRUD lives on the
            detail page. */}
        {mode === 'create' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">填寫人身份</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="filler-type"
                    value="self"
                    checked={fillerType === 'self'}
                    onChange={() => setFillerType('self')}
                  />
                  本人填寫
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="filler-type"
                    value="parent"
                    checked={fillerType === 'parent'}
                    onChange={() => setFillerType('parent')}
                  />
                  家長 / 關係人代填
                </label>
              </div>

              {fillerType === 'parent' ? (
                <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs text-muted-foreground">
                    代填人資料將附掛在學生檔案下,不會建立新的學生名單。
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-relation">
                        與學生關係 <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={contactRelation}
                        onValueChange={(v) => setContactRelation(v as ContactRelation)}
                      >
                        <SelectTrigger id="contact-relation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['父親', '母親', '監護人', '親戚', '其他'] as const).map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-name">
                        代填人姓名 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-name"
                        placeholder="家長姓名"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="contact-phone">代填人手機</Label>
                      <Input
                        id="contact-phone"
                        placeholder="家長手機號碼"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        onBlur={(e) => handleContactPhoneBlur(e.target.value)}
                      />
                      {checkingContactPhone ? (
                        <p className="text-xs text-muted-foreground">查詢中…</p>
                      ) : null}
                      {contactPhoneMatches.length > 0 ? (
                        <ContactPhoneAlert
                          matches={contactPhoneMatches}
                          acknowledged={ignoreContactPhoneDup}
                          onAcknowledge={() => setIgnoreContactPhoneDup(true)}
                        />
                      ) : null}
                      {contactPhoneNotice ? (
                        <RestrictedDuplicateNotice
                          message={contactPhoneNotice}
                          acknowledge={{
                            acknowledged: ignoreContactPhoneDup,
                            onAcknowledge: () => setIgnoreContactPhoneDup(true),
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email">代填人 Email</Label>
                      <Input
                        id="contact-email"
                        placeholder="家長 Email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

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
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      onBlur={(e) => {
                        field.onBlur()
                        // Skip the lookup in edit mode if the value hasn't
                        // changed — querying our own row would always
                        // "find" the student.
                        if (mode === 'edit' && e.target.value === (initialPhone ?? '')) return
                        handlePhoneBlur(e.target.value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {mode === 'create' && checkingDuplicate ? (
                    <p className="text-xs text-muted-foreground">查詢中…</p>
                  ) : null}
                  {mode === 'create' && duplicateWarning ? (
                    <DuplicatePhoneAlert
                      existing={duplicateWarning}
                      acknowledged={ignoreDuplicate}
                      onAcknowledge={() => setIgnoreDuplicate(true)}
                    />
                  ) : null}
                  {mode === 'create' && duplicateNotice ? (
                    <RestrictedDuplicateNotice message={duplicateNotice} />
                  ) : null}
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
                  <FormLabel>學歷</FormLabel>
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
                          {v}
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
                    <NumberInput
                      decimal={false}
                      blankOnZero={false}
                      value={field.value ?? ''}
                      onValueChange={(v) => field.onChange(v === '' ? null : Number(v))}
                      placeholder="例:2024"
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

        {/* 初步成績 — 僅建檔時填寫,後端再補完整 */}
        {mode === 'create' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">初步成績(選填)</CardTitle>
              <p className="text-xs text-muted-foreground">
                有什麼填什麼,後續會由後端顧問補完整(子分數、考試日期、證書等)。前端建檔後不可再回頭改。
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="prelim-gpa">大學 GPA</Label>
                <Input
                  id="prelim-gpa"
                  value={prelimGpa}
                  onChange={(e) => setPrelimGpa(e.target.value)}
                  placeholder="例:3.85"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">4.0 制</p>
              </div>
              <div className="space-y-1.5">
                <Label>英文成績類型</Label>
                <Select
                  value={prelimEngType}
                  onValueChange={(v) => {
                    setPrelimEngType(v as typeof prelimEngType)
                    if (v === 'none') setPrelimEngScore('')
                  }}
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">尚無</SelectItem>
                    <SelectItem value="toefl">TOEFL</SelectItem>
                    <SelectItem value="ielts">IELTS</SelectItem>
                    <SelectItem value="duolingo">Duolingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prelim-eng-score">英文總分</Label>
                <Input
                  id="prelim-eng-score"
                  value={prelimEngScore}
                  onChange={(e) => setPrelimEngScore(e.target.value)}
                  placeholder={
                    prelimEngType === 'toefl'
                      ? '例:105'
                      : prelimEngType === 'ielts'
                        ? '例:7.5'
                        : prelimEngType === 'duolingo'
                          ? '例:135'
                          : '—'
                  }
                  disabled={pending || prelimEngType === 'none'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>標化測驗類型</Label>
                <Select
                  value={prelimStdType}
                  onValueChange={(v) => {
                    setPrelimStdType(v as typeof prelimStdType)
                    if (v === 'none') setPrelimStdScore('')
                  }}
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">尚無</SelectItem>
                    <SelectItem value="gre">GRE</SelectItem>
                    <SelectItem value="gmat">GMAT</SelectItem>
                    <SelectItem value="sat">SAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="prelim-std-score">標化測驗總分</Label>
                <Input
                  id="prelim-std-score"
                  value={prelimStdScore}
                  onChange={(e) => setPrelimStdScore(e.target.value)}
                  placeholder={
                    prelimStdType === 'gre'
                      ? '例:325'
                      : prelimStdType === 'gmat'
                        ? '例:710'
                        : prelimStdType === 'sat'
                          ? '例:1500'
                          : '—'
                  }
                  disabled={pending || prelimStdType === 'none'}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* 名單來源與顧問派發 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">名單來源 + 顧問派發</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="lead_source_id"
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
                      {leadSourceOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label_zh}
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
                      {currentCode === 'marketing_dept' ? '行銷部同事' : '介紹同事'}
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
                      {currentCode === 'brand_introduction' ? '介紹品牌' : '轉介人'}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          {frontendConsultantOptions.length === 0 ? (
                            <SelectItem value="__empty__" disabled>
                              尚無前端部門人員
                            </SelectItem>
                          ) : (
                            frontendConsultantOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="backend_consultant_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>後端顧問</FormLabel>
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
                          {backendConsultantOptions.length === 0 ? (
                            <SelectItem value="__empty__" disabled>
                              尚無後端部門人員
                            </SelectItem>
                          ) : (
                            backendConsultantOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

// duplicate-prevention §2A — inline amber alert under the phone field.
// Shows the matching student's name + frontend consultant, with two CTAs:
//   1) 查看現有名單 — open the existing student in a new tab so the
//      consultant can verify before deciding
//   2) 確認為不同學生,繼續建立 — toggles the ignoreDuplicate flag in the
//      parent so the form can submit (action layer logs an
//      activity_log entry tagged duplicate_phone_override)
function DuplicatePhoneAlert({
  existing,
  acknowledged,
  onAcknowledge,
}: {
  existing: DuplicatePhoneStudent
  acknowledged: boolean
  onAcknowledge: () => void
}) {
  const dt = new Date(existing.created_at).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
  })
  return (
    <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-800">系統找到一筆相同手機號碼的學生</p>
          <p className="mt-0.5 text-xs text-amber-700">
            姓名:<span className="font-medium">{existing.full_name}</span>
            {existing.english_name ? `(${existing.english_name})` : ''}
            {' · '}
            負責顧問:{existing.frontend_consultant_name ?? '未指派'}
            {' · '}
            建立時間:{dt}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/students/${existing.id}`} target="_blank" rel="noopener noreferrer">
                查看現有名單 →
              </Link>
            </Button>
            {acknowledged ? (
              <span className="inline-flex items-center text-xs font-medium text-amber-800">
                ✓ 已確認為不同學生,送出後會記錄供主管審核
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                onClick={onAcknowledge}
              >
                確認為不同學生,繼續建立
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Stage 2-A 最小揭露 — consultant 角色看到的通用重複提示。**不含任何學生 /
// 承辦顧問 / ID 資訊**(可識別資料已在 DB 層 find_*_phone 0045 依角色移除,
// network response 本身就沒有 PII)。兩種用法:
//   * 不帶 acknowledge:硬擋(學生主手機重複,需聯繫主管)。任務三(i)已定案:
//     顧問不可自助覆寫,故不提供「繼續建立」按鈕。
//   * 帶 acknowledge :提示性(代填人手機重複,非後端硬擋),確認後可繼續建立。
function RestrictedDuplicateNotice({
  message,
  acknowledge,
}: {
  message: string
  acknowledge?: { acknowledged: boolean; onAcknowledge: () => void }
}) {
  return (
    <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800">{message}</p>
          {acknowledge ? (
            <div className="mt-2">
              {acknowledge.acknowledged ? (
                <span className="inline-flex items-center text-xs font-medium text-amber-800">
                  ✓ 已確認,送出後仍會建立
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                  onClick={acknowledge.onAcknowledge}
                >
                  仍要繼續建立
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// phone-normalize §3 — contact-phone duplicate alert. Distinct from
// DuplicatePhoneAlert because the meaning is different: the matched number
// might be a student's main phone OR another student's contact, and the
// consultant should see both kinds.
function ContactPhoneAlert({
  matches,
  acknowledged,
  onAcknowledge,
}: {
  matches: ContactPhoneMatch[]
  acknowledged: boolean
  onAcknowledge: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-800">
            此手機號碼已登記在現有學生或其關係人資料中,請確認
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800">
            {matches.map((m) => (
              <li key={`${m.match_type}-${m.match_id}`} className="flex flex-wrap gap-1">
                {m.match_type === 'student' ? (
                  <>
                    <span className="font-medium">學生本人:</span>
                    <Link
                      href={`/students/${m.student_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {m.student_name} →
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="font-medium">
                      {m.contact_name}({m.contact_relation}):
                    </span>
                    <span>於</span>
                    <Link
                      href={`/students/${m.student_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {m.student_name} →
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            {acknowledged ? (
              <span className="text-xs font-medium text-amber-800">
                ✓ 已確認為不同對象,送出後仍會建立此學生與代填人
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                onClick={onAcknowledge}
              >
                確認為不同對象,繼續建立
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
