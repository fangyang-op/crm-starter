'use client'

import { useEffect, useState, useTransition } from 'react'

import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FileUploadButton } from '@/components/ui/file-upload-button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  getUatScreenshotSignedUrl,
  uploadUatScreenshot,
  upsertUatResult,
  type UatResult,
} from './actions'

export type UatItemDto = {
  id: string
  item_code: string
  step_description: string
  expected_result: string
  result: UatResult | null
  note: string
  screenshot_path: string | null
}

export type UatChapterDto = {
  id: string
  title_zh: string
  icon: string
  description: string
  items: UatItemDto[]
}

type ItemState = UatItemDto & {
  saving?: boolean
  uploading?: boolean
}

function chapterStatus(items: ItemState[]): 'done' | 'progress' | 'idle' {
  if (items.length === 0) return 'idle'
  const filled = items.filter((i) => i.result !== null).length
  if (filled === items.length) return 'done'
  if (filled > 0) return 'progress'
  return 'idle'
}

export function UatClient({ chapters: initial }: { chapters: UatChapterDto[] }) {
  const [chapters, setChapters] = useState<
    { meta: Omit<UatChapterDto, 'items'>; items: ItemState[] }[]
  >(() =>
    initial.map((c) => ({
      meta: { id: c.id, title_zh: c.title_zh, icon: c.icon, description: c.description },
      items: c.items.map((i) => ({ ...i })),
    })),
  )
  const [activeIdx, setActiveIdx] = useState(0)
  const active = chapters[activeIdx]

  const updateItem = (chapterIdx: number, itemId: string, patch: Partial<ItemState>) => {
    setChapters((prev) => {
      const next = prev.slice()
      const ch = next[chapterIdx]
      if (!ch) return prev
      next[chapterIdx] = {
        ...ch,
        items: ch.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* 章節 tab — 完成綠、進行中藍、未開始灰。橫向 scroll 在窄螢幕保持
          不換行,避免章節數變多時 layout 跳動。*/}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {chapters.map((c, idx) => {
          const status = chapterStatus(c.items)
          const isActive = idx === activeIdx
          return (
            <button
              key={c.meta.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={cn(
                'shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors',
                isActive && 'ring-2 ring-primary ring-offset-1',
                status === 'done' && 'border-green-200 bg-green-50 text-green-700',
                status === 'progress' && !isActive && 'border-primary/30 bg-primary/5 text-primary',
                status === 'idle' && 'border-muted bg-card text-muted-foreground',
                isActive && status === 'idle' && 'text-foreground',
              )}
            >
              <span className="font-medium">
                {idx + 1}. {c.meta.title_zh}
              </span>
              {status === 'progress' ? (
                <span className="ml-1 text-xs">
                  ({c.items.filter((i) => i.result !== null).length}/{c.items.length})
                </span>
              ) : null}
              {status === 'done' ? <Check size={12} className="ml-1 inline" /> : null}
            </button>
          )
        })}
      </div>

      {active ? (
        <ChapterCard
          key={active.meta.id}
          meta={active.meta}
          items={active.items}
          onItemChange={(itemId, patch) => updateItem(activeIdx, itemId, patch)}
          onSubmitChapter={() => {
            const allFilled = active.items.every((i) => i.result !== null)
            if (!allFilled) {
              toast.error('請先填完本章節所有項目')
              return
            }
            if (activeIdx < chapters.length - 1) {
              toast.success(`已送出「${active.meta.title_zh}」,進入下一章節`)
              setActiveIdx(activeIdx + 1)
            } else {
              toast.success('所有章節已完成,感謝您的回報!')
            }
          }}
        />
      ) : null}
    </div>
  )
}

function ChapterCard({
  meta,
  items,
  onItemChange,
  onSubmitChapter,
}: {
  meta: { id: string; title_zh: string; icon: string; description: string }
  items: ItemState[]
  onItemChange: (itemId: string, patch: Partial<ItemState>) => void
  onSubmitChapter: () => void
}) {
  const filled = items.filter((i) => i.result !== null).length
  const total = items.length
  const progress = total === 0 ? 0 : (filled / total) * 100

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{meta.title_zh}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>進度</span>
            <span>
              {filled} / {total}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <ul className="divide-y">
        {items.map((item) => (
          <UatItemRow
            key={item.id}
            item={item}
            onChange={(patch) => onItemChange(item.id, patch)}
          />
        ))}
      </ul>

      <div className="border-t p-4">
        <Button onClick={onSubmitChapter} disabled={filled !== total} className="w-full sm:w-auto">
          送出本章節
        </Button>
      </div>
    </div>
  )
}

function UatItemRow({
  item,
  onChange,
}: {
  item: ItemState
  onChange: (patch: Partial<ItemState>) => void
}) {
  const [pending, startTransition] = useTransition()
  const [noteDraft, setNoteDraft] = useState(item.note)

  // 當 server-side 改了(例如初次 load 帶入舊紀錄),把 draft 同步過來。
  useEffect(() => {
    setNoteDraft(item.note)
  }, [item.note])

  const saveResult = (result: UatResult) => {
    onChange({ result, saving: true })
    startTransition(async () => {
      const res = await upsertUatResult(item.id, result, noteDraft)
      if (!res.ok) {
        toast.error(res.error)
        onChange({ saving: false })
        return
      }
      onChange({ saving: false })
    })
  }

  const saveNote = () => {
    if (!item.result) return
    if (noteDraft === item.note) return
    onChange({ note: noteDraft, saving: true })
    startTransition(async () => {
      const res = await upsertUatResult(item.id, item.result as UatResult, noteDraft)
      if (!res.ok) {
        toast.error(res.error)
        onChange({ saving: false })
        return
      }
      onChange({ saving: false })
    })
  }

  const onScreenshot = (file: File) => {
    if (!item.result) {
      toast.error('請先選擇通過或失敗')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    onChange({ uploading: true })
    startTransition(async () => {
      const res = await uploadUatScreenshot(item.id, fd)
      if (!res.ok) {
        toast.error(res.error)
        onChange({ uploading: false })
        return
      }
      onChange({ uploading: false, screenshot_path: res.screenshot_path ?? null })
      toast.success('截圖已上傳')
    })
  }

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {item.item_code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.step_description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">預期:{item.expected_result}</p>
        </div>
        {item.saving ? (
          <Loader2 size={14} className="mt-1 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-12">
        <Button
          type="button"
          size="sm"
          variant={item.result === 'pass' ? 'default' : 'outline'}
          className={cn(item.result === 'pass' && 'bg-green-600 hover:bg-green-700')}
          onClick={() => saveResult('pass')}
          disabled={pending}
        >
          <Check size={14} className="mr-1" /> 通過
        </Button>
        <Button
          type="button"
          size="sm"
          variant={item.result === 'fail' ? 'destructive' : 'outline'}
          onClick={() => saveResult('fail')}
          disabled={pending}
        >
          <X size={14} className="mr-1" /> 失敗
        </Button>
      </div>

      {item.result ? (
        <div className="space-y-2 pl-12">
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            placeholder="備註(選填) — 失敗的話建議寫下發生狀況"
            rows={2}
            className="text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <FileUploadButton
              accept="image/*"
              maxMB={5}
              variant="button"
              label={
                item.uploading
                  ? '上傳中…'
                  : item.screenshot_path
                    ? '重新上傳截圖'
                    : '附上截圖(選填)'
              }
              onChange={onScreenshot}
              disabled={item.uploading}
            />
            {item.screenshot_path ? <ScreenshotPreview path={item.screenshot_path} /> : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

function ScreenshotPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // signed URL 60 秒短效;path 變動(重新上傳)就重抓。cancelled flag
  // 防止 race — 連續上傳時舊的 promise 後到不會覆蓋新 url。
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    setLoading(true)
    getUatScreenshotSignedUrl(path).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setUrl(res.url)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (loading) return <span className="text-xs text-muted-foreground">載入縮圖…</span>
  if (error) return <span className="text-xs text-red-500">{error}</span>
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="截圖預覽"
        className="h-16 w-16 rounded border object-cover hover:ring-2 hover:ring-primary"
      />
    </a>
  )
}
