'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { calculateWordDiff } from '@/lib/word-diff'

import { createMasterVersion } from '@/app/(dashboard)/students/[id]/documents/actions'

type Props = {
  studentId: string
  masterId: string
  initialContent: string
  remainingQuota: number | null
  canEdit: boolean
}

export function MasterEditor({
  studentId,
  masterId,
  initialContent,
  remainingQuota,
  canEdit,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [content, setContent] = useState(initialContent)
  const [changeNote, setChangeNote] = useState('')

  const diff = useMemo(() => calculateWordDiff(initialContent, content), [initialContent, content])
  const dirty = content !== initialContent
  const wouldDeficit =
    remainingQuota !== null && diff.wordsChanged > 0 && remainingQuota - diff.wordsChanged < 0

  const handleSave = () => {
    if (!dirty) {
      toast.info('沒有變更')
      return
    }
    if (wouldDeficit) {
      const confirmed = window.confirm(
        `儲存後字數餘額會變成負數(${remainingQuota} − ${diff.wordsChanged})。確定要繼續嗎?`,
      )
      if (!confirmed) return
    }

    startTransition(async () => {
      const result = await createMasterVersion(studentId, {
        master_id: masterId,
        content,
        change_note: changeNote.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.wordsChanged && result.wordsChanged > 0
          ? `已儲存 V → 扣 ${result.wordsChanged} 字`
          : '已儲存(0 字變動,不扣)',
      )
      setChangeNote('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 text-xs">
        <Card>
          <CardContent className="space-y-0.5 p-3">
            <p className="text-muted-foreground">目前字數</p>
            <p className="text-base font-semibold tabular-nums">
              {diff.currentCount.toLocaleString('zh-TW')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-0.5 p-3">
            <p className="text-muted-foreground">本次動到</p>
            <p
              className={
                'text-base font-semibold tabular-nums ' +
                (diff.wordsChanged > 0 ? 'text-destructive' : 'text-muted-foreground')
              }
            >
              {diff.wordsChanged > 0 ? `−${diff.wordsChanged.toLocaleString('zh-TW')}` : '0'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-0.5 p-3">
            <p className="text-muted-foreground">儲存後餘額</p>
            <p
              className={
                'text-base font-semibold tabular-nums ' +
                (remainingQuota === null
                  ? 'text-muted-foreground'
                  : wouldDeficit
                    ? 'text-destructive'
                    : '')
              }
            >
              {remainingQuota === null
                ? '—'
                : (remainingQuota - diff.wordsChanged).toLocaleString('zh-TW')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
        className="font-mono text-sm"
        placeholder="在此撰寫文件內容..."
        disabled={!canEdit || pending}
      />

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="change-note" className="text-xs">
              變更摘要(選填)
            </Label>
            <Input
              id="change-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="例:加強研究動機段"
              disabled={pending}
            />
          </div>
          <Button onClick={handleSave} disabled={!dirty || pending}>
            <Save size={14} className="mr-1.5" />
            {pending ? '儲存中…' : '儲存新版本'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">你沒有編輯這位學生文件的權限。</p>
      )}
    </div>
  )
}
