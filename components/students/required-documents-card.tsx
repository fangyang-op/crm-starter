'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { Check, CheckCircle2, ChevronRight, FileText, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUploadButton } from '@/components/ui/file-upload-button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  clearRequiredDocument,
  getRequiredDocSignedUrl,
  setRequiredStatus,
  toggleRequired,
  uploadRequiredDocument,
} from '@/app/(dashboard)/students/[id]/required-documents/actions'

export type RequiredDocItem = {
  template_id: string
  code: string
  label_zh: string
  category: 'school_application' | 'visa_enrollment' | 'other'
  notes: string | null
  /** Per-student state (may not exist yet). */
  record_id: string | null
  is_required: boolean
  status: 'pending' | 'uploaded' | 'verified' | 'rejected'
  file_path: string | null
}

type Props = {
  studentId: string
  items: RequiredDocItem[]
  canEdit: boolean
}

const STATUS_CONFIG: Record<
  RequiredDocItem['status'],
  { label: string; className: string; dotClass: string; textClass: string }
> = {
  pending: {
    label: '待上傳',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-500',
  },
  uploaded: {
    label: '已上傳',
    className: 'bg-blue-100 text-blue-700 border-blue-300',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600',
  },
  verified: {
    label: '已驗證',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
  },
  rejected: {
    label: '退件',
    className: 'bg-rose-100 text-rose-700 border-rose-300',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600',
  },
}

const CATEGORY_LABEL: Record<RequiredDocItem['category'], string> = {
  school_application: '學校申請文件',
  visa_enrollment: '簽證入學文件',
  other: '其他',
}

export function RequiredDocumentsCard({ studentId, items, canEdit }: Props) {
  const [open, setOpen] = useState(false)

  // Compact stats for the trigger card.
  const required = items.filter((i) => i.is_required)
  const uploaded = required.filter((i) => i.status === 'uploaded' || i.status === 'verified').length
  const verified = required.filter((i) => i.status === 'verified').length
  const rejected = required.filter((i) => i.status === 'rejected').length

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="cursor-pointer transition-colors hover:border-primary"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} />
            申請準備檔案
          </CardTitle>
          <ChevronRight size={16} className="text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">已上傳 / 應收</span>
            <span className="tabular-nums">
              <span className="text-2xl font-semibold text-foreground">{uploaded}</span>
              <span className="text-muted-foreground"> / {required.length}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1.5 text-xs">
            {verified > 0 ? (
              <Badge variant="outline" className={STATUS_CONFIG.verified.className}>
                {verified} 已驗證
              </Badge>
            ) : null}
            {rejected > 0 ? (
              <Badge variant="outline" className={STATUS_CONFIG.rejected.className}>
                {rejected} 退件
              </Badge>
            ) : null}
            {uploaded === 0 && rejected === 0 ? (
              <Badge variant="outline" className={STATUS_CONFIG.pending.className}>
                尚未開始
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>申請準備檔案</SheetTitle>
            <SheetDescription>
              ⚠ 各校申請要求不同 · 提醒英文拼字與護照相同 · 建議彩色掃描或拍照。
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <DocList studentId={studentId} items={items} canEdit={canEdit} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function DocList({ studentId, items, canEdit }: Props) {
  const grouped = new Map<RequiredDocItem['category'], RequiredDocItem[]>()
  for (const it of items) {
    const arr = grouped.get(it.category) ?? []
    arr.push(it)
    grouped.set(it.category, arr)
  }

  // v1.1 §4: track recently-uploaded items so we can render an inline
  // "✓ 上傳成功" beside the row for ~1.5s without bouncing the user out of
  // the panel. Also keeps a ref map so handleUpload can scroll to the next
  // pending row after a successful upload.
  const [recentlyUploaded, setRecentlyUploaded] = useState<Set<string>>(new Set())
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  // Build the same flat ordered list the rows render in, so "next pending"
  // matches what the user sees on screen.
  const flatOrdered: RequiredDocItem[] = []
  for (const cat of ['school_application', 'visa_enrollment', 'other'] as const) {
    const list = grouped.get(cat) ?? []
    flatOrdered.push(...[...list].sort((a, b) => a.label_zh.localeCompare(b.label_zh)))
  }

  const handleUploaded = useCallback(
    (templateId: string) => {
      setRecentlyUploaded((prev) => {
        const next = new Set(prev)
        next.add(templateId)
        return next
      })
      // Auto-clear the inline indicator after 1.5s.
      window.setTimeout(() => {
        setRecentlyUploaded((prev) => {
          if (!prev.has(templateId)) return prev
          const next = new Set(prev)
          next.delete(templateId)
          return next
        })
      }, 1500)

      // Find the next item that's still required + pending, AFTER the just-
      // uploaded one in the rendered order. Falls back to the first such item
      // if the uploaded one was the last in the list.
      const idx = flatOrdered.findIndex((i) => i.template_id === templateId)
      const after = idx >= 0 ? flatOrdered.slice(idx + 1) : flatOrdered
      const nextPending =
        after.find((i) => i.is_required && i.status === 'pending') ??
        flatOrdered.find(
          (i) => i.is_required && i.status === 'pending' && i.template_id !== templateId,
        )
      if (nextPending) {
        // Defer one frame so the ref map has the latest entries after refresh.
        window.requestAnimationFrame(() => {
          const el = rowRefs.current.get(nextPending.template_id)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    },
    // flatOrdered is recomputed each render but its identity changes only when
    // items change — exhaustive-deps disabled to avoid useMemo noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  )

  return (
    <div className="space-y-4">
      {(['school_application', 'visa_enrollment', 'other'] as const).map((cat) => {
        const list = grouped.get(cat) ?? []
        if (list.length === 0) return null
        return (
          <div key={cat} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {CATEGORY_LABEL[cat]}
            </p>
            {list
              .sort((a, b) => a.label_zh.localeCompare(b.label_zh))
              .map((it) => (
                <DocRow
                  key={it.template_id}
                  studentId={studentId}
                  item={it}
                  canEdit={canEdit}
                  justUploaded={recentlyUploaded.has(it.template_id)}
                  onUploaded={handleUploaded}
                  rowRef={(el) => {
                    if (el) rowRefs.current.set(it.template_id, el)
                    else rowRefs.current.delete(it.template_id)
                  }}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

function DocRow({
  studentId,
  item,
  canEdit,
  justUploaded,
  onUploaded,
  rowRef,
}: {
  studentId: string
  item: RequiredDocItem
  canEdit: boolean
  justUploaded: boolean
  onUploaded: (templateId: string) => void
  rowRef: (el: HTMLDivElement | null) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [downloading, startDownload] = useTransition()
  const cfg = STATUS_CONFIG[item.status]
  const localRef = useRef<HTMLDivElement | null>(null)

  // Forward to the parent's ref-map so it can scroll to next-pending after
  // an upload. Fire on mount + when the row's id changes.
  useEffect(() => {
    rowRef(localRef.current)
    return () => rowRef(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.template_id])

  const handleToggle = (next: boolean) => {
    startTransition(async () => {
      const r = await toggleRequired(studentId, item.template_id, next)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleUpload = (file: File | null) => {
    if (!file) return
    const fd = new FormData()
    fd.set('template_id', item.template_id)
    fd.set('code', item.code)
    fd.set('file', file)
    startTransition(async () => {
      const r = await uploadRequiredDocument(studentId, fd)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // v1.1 §4: parent handles inline "✓ 上傳成功" + scroll-to-next.
      // No global toast — keeps the user inside the panel without a banner.
      onUploaded(item.template_id)
      router.refresh()
    })
  }

  const handleClear = () => {
    if (!window.confirm(`確定移除「${item.label_zh}」上傳的檔案?`)) return
    startTransition(async () => {
      const r = await clearRequiredDocument(studentId, item.template_id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleStatus = (status: 'verified' | 'rejected') => {
    if (!item.record_id) return
    startTransition(async () => {
      const r = await setRequiredStatus(studentId, item.record_id!, status)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleDownload = () => {
    if (!item.file_path) return
    startDownload(async () => {
      const r = await getRequiredDocSignedUrl(item.file_path!)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div
      ref={localRef}
      className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Checkbox
          checked={item.is_required}
          onCheckedChange={(v) => handleToggle(v === true)}
          disabled={!canEdit || pending}
          className="mt-0.5"
        />
        {/* v1.2 §2: status dot + Chinese label side by side, sitting before
            the document name. Order is now: checkbox → dot → status text →
            document name. Each status has its own text colour matching the
            dot, so the line reads at a glance even with multiple rows. */}
        <span
          className={`mt-1.5 inline-flex shrink-0 items-center gap-1 ${cfg.textClass}`}
          aria-label={cfg.label}
        >
          <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} aria-hidden />
          <span className="text-xs font-medium">{cfg.label}</span>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={item.is_required ? 'font-medium' : 'text-muted-foreground line-through'}
            >
              {item.label_zh}
            </span>
            {justUploaded ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                <Check size={12} /> 上傳成功
              </span>
            ) : null}
          </div>
          {item.notes ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {item.file_path ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? '…' : '下載'}
            </Button>
            {canEdit ? (
              <>
                {item.status === 'uploaded' ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-emerald-700"
                      onClick={() => handleStatus('verified')}
                      disabled={pending}
                      title="標為已驗證"
                    >
                      <CheckCircle2 size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-700"
                      onClick={() => handleStatus('rejected')}
                      disabled={pending}
                      title="退件"
                    >
                      <XCircle size={14} />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={pending}
                >
                  移除
                </Button>
              </>
            ) : null}
          </>
        ) : canEdit && item.is_required ? (
          <FileUploadButton
            variant="button"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(f) => handleUpload(f)}
            disabled={pending}
          />
        ) : null}
      </div>
    </div>
  )
}
