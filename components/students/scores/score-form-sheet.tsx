'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { FileText, Paperclip, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { SCORE_TYPE_CONFIG, SCORE_TYPE_VALUES, type ScoreType } from '@/lib/constants/score-type'

import { createScore, updateScore } from '@/app/(dashboard)/students/[id]/scores/actions'

export type ScoreFormInitial = {
  id: string
  score_type: ScoreType
  total_score: string | null
  sub_scores: Record<string, string | number | null> | null
  test_date: string | null
  expiry_date: string | null
  is_official: boolean
  notes: string | null
  certificate_storage_path: string | null
}

type Props = {
  studentId: string
  initial: ScoreFormInitial | null
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function ScoreFormSheet({ studentId, initial, open, onOpenChange }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const isEdit = Boolean(initial)

  const [scoreType, setScoreType] = useState<ScoreType>(initial?.score_type ?? 'toefl')
  const [totalScore, setTotalScore] = useState(initial?.total_score ?? '')
  const [subScores, setSubScores] = useState<Record<string, string>>(
    coerceSubToString(initial?.sub_scores),
  )
  const [testDate, setTestDate] = useState(initial?.test_date ?? '')
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? '')
  const [isOfficial, setIsOfficial] = useState(initial?.is_official ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [file, setFile] = useState<File | null>(null)
  const [removeCert, setRemoveCert] = useState(false)

  // Reset when switching between create / edit / different score
  useEffect(() => {
    setScoreType(initial?.score_type ?? 'toefl')
    setTotalScore(initial?.total_score ?? '')
    setSubScores(coerceSubToString(initial?.sub_scores))
    setTestDate(initial?.test_date ?? '')
    setExpiryDate(initial?.expiry_date ?? '')
    setIsOfficial(initial?.is_official ?? false)
    setNotes(initial?.notes ?? '')
    setFile(null)
    setRemoveCert(false)
  }, [initial])

  const cfg = SCORE_TYPE_CONFIG[scoreType]
  const subFieldKeys = useMemo(() => cfg.subFields.map((f) => f.key), [cfg.subFields])

  const handleSubChange = (key: string, value: string) => {
    setSubScores((prev) => ({ ...prev, [key]: value }))
  }

  const submit = () => {
    const fd = new FormData()
    if (initial) fd.set('score_id', initial.id)
    fd.set('student_id', studentId)
    fd.set('score_type', scoreType)
    fd.set('total_score', totalScore)
    fd.set('test_date', testDate)
    fd.set('expiry_date', expiryDate)
    fd.set('is_official', isOfficial ? 'true' : 'false')
    fd.set('notes', notes)

    // Only persist sub_scores fields relevant to the chosen type, and coerce
    // numeric-looking strings to numbers for cleaner JSON.
    const cleanedSub: Record<string, string | number | null> = {}
    for (const key of subFieldKeys) {
      const v = subScores[key]?.trim()
      if (!v) continue
      const n = Number(v)
      cleanedSub[key] = Number.isFinite(n) && v === String(n) ? n : v
    }
    fd.set('sub_scores', JSON.stringify(cleanedSub))

    if (file) fd.set('certificate', file)
    if (removeCert) fd.set('remove_certificate', 'true')

    startTransition(async () => {
      const r = isEdit ? await updateScore(fd) : await createScore(fd)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(isEdit ? '已更新成績' : '已新增成績')
      onOpenChange(false)
      router.refresh()
    })
  }

  const hasExistingCert = Boolean(initial?.certificate_storage_path) && !removeCert && !file

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? '編輯成績' : '新增成績'}</SheetTitle>
          <SheetDescription>
            填寫主分數;子項分數依考試類型自動切換,證書檔案最大 10MB(圖片或 PDF)。
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">考試類型</Label>
              <Select
                value={scoreType}
                onValueChange={(v) => setScoreType(v as ScoreType)}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORE_TYPE_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SCORE_TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="total" className="text-xs">
                主分數
              </Label>
              <Input
                id="total"
                value={totalScore}
                onChange={(e) => setTotalScore(e.target.value)}
                placeholder={cfg.totalPlaceholder}
                disabled={pending}
              />
            </div>
          </div>

          {cfg.subFields.length > 0 ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">子項分數</p>
              <div className="grid grid-cols-2 gap-2">
                {cfg.subFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={`sub-${f.key}`} className="text-xs">
                      {f.label}
                      {f.hint ? (
                        <span className="ml-1 text-muted-foreground">({f.hint})</span>
                      ) : null}
                    </Label>
                    <Input
                      id={`sub-${f.key}`}
                      value={subScores[f.key] ?? ''}
                      onChange={(e) => handleSubChange(f.key, e.target.value)}
                      disabled={pending}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="test-date" className="text-xs">
                考試日期
              </Label>
              <Input
                id="test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expiry-date" className="text-xs">
                到期日期
              </Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="official"
              checked={isOfficial}
              onCheckedChange={(v) => setIsOfficial(v === true)}
              disabled={pending}
            />
            <Label htmlFor="official" className="text-xs">
              已收到正本送分(is_official)
            </Label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">證書檔案</Label>
            {hasExistingCert ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
                <FileText size={14} className="text-muted-foreground" />
                <span className="flex-1 truncate">已上傳證書</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoveCert(true)}
                  disabled={pending}
                >
                  <Trash2 size={12} className="mr-1" />
                  移除
                </Button>
              </div>
            ) : null}
            {file ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
                <Paperclip size={14} className="text-muted-foreground" />
                <span className="flex-1 truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFile(null)}
                  disabled={pending}
                  aria-label="清除"
                >
                  <X size={12} />
                </Button>
              </div>
            ) : null}
            {!file && removeCert ? (
              <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                儲存後將移除目前的證書。
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setRemoveCert(false)}
                >
                  取消移除
                </button>
              </p>
            ) : null}
            {!file && !hasExistingCert && !removeCert ? (
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={pending}
              />
            ) : null}
            {(file || removeCert) && hasExistingCert === false ? null : null}
            {file ? <p className="text-[11px] text-muted-foreground">將取代現有證書</p> : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              備註
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>

          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? '儲存中…' : isEdit ? '儲存變更' : '新增成績'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function coerceSubToString(
  sub: Record<string, string | number | null> | null | undefined,
): Record<string, string> {
  if (!sub) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(sub)) {
    if (v === null || v === undefined) continue
    out[k] = String(v)
  }
  return out
}
