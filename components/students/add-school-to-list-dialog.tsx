'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { COUNTRY_LABELS, DEGREE_LEVEL_LABELS } from '@/lib/constants/school'
import { TIER_LABELS, TIER_VALUES, type Tier } from '@/lib/constants/tier'

import { addSchoolListItem } from '@/app/(dashboard)/students/[id]/school-lists/actions'

import type { ProgramOption, SchoolOption } from './school-list-section'

type Props = {
  studentId: string
  listId: string
  schools: SchoolOption[]
  programs: ProgramOption[]
  trigger: React.ReactNode
}

export function AddSchoolToListDialog({ studentId, listId, schools, programs, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [schoolId, setSchoolId] = useState<string>('')
  const [programId, setProgramId] = useState<string>('__none__')
  const [programOverride, setProgramOverride] = useState('')
  const [tier, setTier] = useState<Tier>('match')
  const [notes, setNotes] = useState('')

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return schools.slice(0, 50)
    return schools
      .filter(
        (s) =>
          s.name_en.toLowerCase().includes(q) ||
          s.name_zh?.toLowerCase().includes(q) ||
          s.short_name?.toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [schools, search])

  const programOptionsForSchool = useMemo(
    () => programs.filter((p) => p.school_id === schoolId),
    [programs, schoolId],
  )

  const reset = () => {
    setSearch('')
    setSchoolId('')
    setProgramId('__none__')
    setProgramOverride('')
    setTier('match')
    setNotes('')
  }

  const submit = () => {
    if (!schoolId) {
      toast.error('請選擇學校')
      return
    }
    startTransition(async () => {
      const r = await addSchoolListItem(studentId, {
        school_list_id: listId,
        school_id: schoolId,
        program_id: programId === '__none__' ? null : programId,
        program_name_override: programOverride.trim() || null,
        tier,
        notes: notes.trim() || null,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已加入')
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>加入學校</DialogTitle>
          <DialogDescription>從學校資料庫選一所,設定 tier 與科系。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="school-search">搜尋學校</Label>
            <Input
              id="school-search"
              placeholder="英文 / 中文 / 簡稱"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>學校</Label>
            <Select
              value={schoolId}
              onValueChange={(v) => {
                setSchoolId(v)
                setProgramId('__none__')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇" />
              </SelectTrigger>
              <SelectContent>
                {filteredSchools.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    沒有符合的學校
                  </SelectItem>
                ) : (
                  filteredSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.short_name ? `[${s.short_name}] ` : ''}
                      {s.name_en}
                      {' · '}
                      {COUNTRY_LABELS[s.country as keyof typeof COUNTRY_LABELS] ?? s.country}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {schoolId ? (
            <div className="space-y-1.5">
              <Label>科系</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定 / 自填</SelectItem>
                  {programOptionsForSchool.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.program_name}
                      {' · '}
                      {DEGREE_LEVEL_LABELS[p.degree_level as keyof typeof DEGREE_LEVEL_LABELS] ??
                        p.degree_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {programId === '__none__' ? (
                <Input
                  className="mt-2"
                  placeholder="或自填科系名稱(選填)"
                  value={programOverride}
                  onChange={(e) => setProgramOverride(e.target.value)}
                />
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-notes">備註(選填)</Label>
            <Textarea
              id="add-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !schoolId}>
            {pending ? '加入中…' : '加入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
