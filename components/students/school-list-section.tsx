'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { ArrowDown, ArrowUp, Lock, LockKeyhole, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AddSchoolToListDialog } from '@/components/students/add-school-to-list-dialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { COUNTRY_LABELS } from '@/lib/constants/school'
import { TIER_BADGE_CLASS, TIER_LABELS, TIER_VALUES, type Tier } from '@/lib/constants/tier'

import {
  createSchoolList,
  lockSchoolList,
  removeSchoolListItem,
  setCurrentSchoolList,
  updateSchoolListItem,
} from '@/app/(dashboard)/students/[id]/school-lists/actions'

export type SchoolListItem = {
  id: string
  school_id: string
  school_name: string
  school_country: string
  program_id: string | null
  program_name: string | null
  program_name_override: string | null
  tier: Tier
  display_order: number
  notes: string | null
}

export type SchoolListVersion = {
  id: string
  version_number: number
  name: string
  is_locked: boolean
  is_current: boolean
  created_at: string
  items: SchoolListItem[]
}

export type SchoolOption = {
  id: string
  name_en: string
  name_zh: string | null
  short_name: string | null
  country: string
}

export type ProgramOption = {
  id: string
  school_id: string
  program_name: string
  degree_level: string
}

type Props = {
  studentId: string
  versions: SchoolListVersion[]
  schoolOptions: SchoolOption[]
  programOptions: ProgramOption[]
  canEdit: boolean
}

export function SchoolListSection({
  studentId,
  versions,
  schoolOptions,
  programOptions,
  canEdit,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version_number - a.version_number),
    [versions],
  )
  const currentDefault = sorted.find((v) => v.is_current) ?? sorted[0]
  const [selectedId, setSelectedId] = useState<string>(currentDefault?.id ?? '')

  const selected = useMemo(
    () => sorted.find((v) => v.id === selectedId) ?? sorted[0],
    [sorted, selectedId],
  )

  // No versions yet — show empty state with "create first"
  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <h3 className="text-sm font-medium">尚無選校表</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          建立第一份版本後可以加入學校、設 tier、鎖定。
        </p>
        {canEdit ? (
          <div className="mt-4">
            <NewVersionDialog
              studentId={studentId}
              existingVersions={sorted}
              trigger={
                <Button>
                  <Plus className="mr-1.5" size={16} />
                  建立 V1
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    )
  }

  if (!selected) return null

  const handleSetCurrent = () => {
    startTransition(async () => {
      const r = await setCurrentSchoolList(studentId, selected.id)
      if (!r.ok) toast.error(r.error)
      else {
        toast.success('已設為當前版本')
        router.refresh()
      }
    })
  }

  const handleLock = () => {
    startTransition(async () => {
      const r = await lockSchoolList(studentId, selected.id)
      if (!r.ok) toast.error(r.error)
      else {
        toast.success('已鎖定此版本')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  V{v.version_number} · {v.name}
                  {v.is_current ? '(當前)' : ''}
                  {v.is_locked ? ' 🔒' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected.is_current ? (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              <Star size={12} className="mr-1" />
              當前
            </Badge>
          ) : null}
          {selected.is_locked ? (
            <Badge variant="outline">
              <Lock size={12} className="mr-1" />
              已鎖定
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !selected.is_current ? (
            <Button variant="outline" size="sm" onClick={handleSetCurrent} disabled={pending}>
              <Star size={14} className="mr-1" />
              設為當前
            </Button>
          ) : null}
          {canEdit && !selected.is_locked ? (
            <ConfirmLockDialog onConfirm={handleLock} pending={pending} />
          ) : null}
          {canEdit ? (
            <NewVersionDialog
              studentId={studentId}
              existingVersions={sorted}
              defaultCopyFromId={selected.id}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={14} className="mr-1" />
                  新版本
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      {selected.items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {selected.is_locked
            ? '此版本沒有任何學校。'
            : canEdit
              ? '尚未加入任何學校。點下方「加入學校」開始選校。'
              : '尚未加入任何學校。'}
        </div>
      ) : (
        <div className="space-y-2">
          {selected.items
            .sort((a, b) => a.display_order - b.display_order)
            .map((item, idx) => (
              <SchoolItemRow
                key={item.id}
                item={item}
                studentId={studentId}
                listLocked={selected.is_locked}
                isFirst={idx === 0}
                isLast={idx === selected.items.length - 1}
                canEdit={canEdit}
                allItems={selected.items}
              />
            ))}
        </div>
      )}

      {canEdit && !selected.is_locked ? (
        <AddSchoolToListDialog
          studentId={studentId}
          listId={selected.id}
          schools={schoolOptions}
          programs={programOptions}
          trigger={
            <Button variant="outline" className="w-full">
              <Plus size={16} className="mr-1.5" />
              加入學校
            </Button>
          }
        />
      ) : null}
    </div>
  )
}

function SchoolItemRow({
  item,
  studentId,
  listLocked,
  isFirst,
  isLast,
  canEdit,
  allItems,
}: {
  item: SchoolListItem
  studentId: string
  listLocked: boolean
  isFirst: boolean
  isLast: boolean
  canEdit: boolean
  allItems: SchoolListItem[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const readOnly = listLocked || !canEdit

  const moveBy = (delta: number) => {
    const sorted = [...allItems].sort((a, b) => a.display_order - b.display_order)
    const idx = sorted.findIndex((s) => s.id === item.id)
    const next = sorted[idx + delta]
    if (!next) return

    startTransition(async () => {
      // Swap display_order between item and next
      const r1 = await updateSchoolListItem(
        studentId,
        item.id,
        item.tier,
        next.display_order,
        item.notes,
      )
      const r2 = await updateSchoolListItem(
        studentId,
        next.id,
        next.tier,
        item.display_order,
        next.notes,
      )
      if (!r1.ok || !r2.ok) {
        toast.error(r1.ok ? (r2.ok ? '' : r2.error) : r1.error)
        return
      }
      router.refresh()
    })
  }

  const handleTierChange = (newTier: Tier) => {
    startTransition(async () => {
      const r = await updateSchoolListItem(
        studentId,
        item.id,
        newTier,
        item.display_order,
        item.notes,
      )
      if (!r.ok) toast.error(r.error)
      else router.refresh()
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      const r = await removeSchoolListItem(studentId, item.id)
      if (!r.ok) toast.error(r.error)
      else {
        toast.success('已移除')
        router.refresh()
      }
    })
  }

  const programLabel = item.program_name_override ?? item.program_name ?? '未指定科系'

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={readOnly || isFirst || pending}
            onClick={() => moveBy(-1)}
            aria-label="上移"
          >
            <ArrowUp size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={readOnly || isLast || pending}
            onClick={() => moveBy(1)}
            aria-label="下移"
          >
            <ArrowDown size={14} />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {readOnly ? (
              <Badge variant="outline" className={cn('border', TIER_BADGE_CLASS[item.tier])}>
                {TIER_LABELS[item.tier]}
              </Badge>
            ) : (
              <Select
                value={item.tier}
                onValueChange={(v) => handleTierChange(v as Tier)}
                disabled={pending}
              >
                <SelectTrigger className={cn('h-7 w-[100px] text-xs', TIER_BADGE_CLASS[item.tier])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIER_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-xs text-muted-foreground">
              {COUNTRY_LABELS[item.school_country as keyof typeof COUNTRY_LABELS] ??
                item.school_country}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium">{item.school_name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{programLabel}</span>
          </div>
          {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
        </div>

        {!readOnly ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={pending} aria-label="移除">
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>確定要移除這所學校?</AlertDialogTitle>
                <AlertDialogDescription>
                  從本版選校表移除「{item.school_name}」。歷史版本不受影響。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove}>移除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  )
}

function NewVersionDialog({
  studentId,
  existingVersions,
  defaultCopyFromId,
  trigger,
}: {
  studentId: string
  existingVersions: SchoolListVersion[]
  defaultCopyFromId?: string
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const nextVersion = (existingVersions[0]?.version_number ?? 0) + 1
  const [name, setName] = useState(`V${nextVersion}`)
  const [copyFromId, setCopyFromId] = useState<string>(defaultCopyFromId ?? '__none__')

  const submit = () => {
    if (!name.trim()) {
      toast.error('請填寫版本名稱')
      return
    }
    startTransition(async () => {
      const r = await createSchoolList({
        student_id: studentId,
        name: name.trim(),
        copy_from_list_id: copyFromId === '__none__' ? null : copyFromId,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已建立新版本')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setName(`V${nextVersion}`)
          setCopyFromId(defaultCopyFromId ?? '__none__')
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建選校表版本</DialogTitle>
          <DialogDescription>可以選擇從現有版本複製內容,或從空白開始。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="version-name">版本名稱</Label>
            <Input
              id="version-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例:V2 衝刺版"
            />
          </div>
          {existingVersions.length > 0 ? (
            <div className="space-y-1.5">
              <Label>複製來源</Label>
              <Select value={copyFromId} onValueChange={setCopyFromId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">空白</SelectItem>
                  {existingVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      V{v.version_number} · {v.name}({v.items.length} 校)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '建立中…' : '建立'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmLockDialog({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <LockKeyhole size={14} className="mr-1" />
          鎖定
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>鎖定後不可再修改本版</AlertDialogTitle>
          <AlertDialogDescription>
            鎖定後本版的學校清單、tier、排序都無法再變動。確定下去嗎? (要再改可以新建一個版本,或請
            admin 從 SQL 解鎖)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            鎖定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
