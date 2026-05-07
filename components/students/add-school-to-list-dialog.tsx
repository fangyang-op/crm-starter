'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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

  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false)
  const [schoolId, setSchoolId] = useState<string>('')
  const [programId, setProgramId] = useState<string>('__none__')
  const [programOverride, setProgramOverride] = useState('')
  const [tier, setTier] = useState<Tier>('match')
  const [notes, setNotes] = useState('')

  const selectedSchool = useMemo(() => schools.find((s) => s.id === schoolId), [schools, schoolId])

  const programOptionsForSchool = useMemo(
    () => programs.filter((p) => p.school_id === schoolId),
    [programs, schoolId],
  )

  const reset = () => {
    setSchoolId('')
    setProgramId('__none__')
    setProgramOverride('')
    setTier('match')
    setNotes('')
    setSchoolPickerOpen(false)
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
          {/* v1.2 §4: combobox replaces the old "搜尋 input + 學校 Select"
              pair. Why: Radix Select swallowed keystrokes once open (its
              built-in typeahead), so the external search input was unreachable.
              CMDK's Command lets the user type directly into the dropdown
              and filters in-place across name_zh / name_en / short_name. */}
          <div className="space-y-1.5">
            <Label>學校</Label>
            <Popover open={schoolPickerOpen} onOpenChange={setSchoolPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={schoolPickerOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn('truncate', !selectedSchool && 'text-muted-foreground')}>
                    {selectedSchool
                      ? `${selectedSchool.short_name ? `[${selectedSchool.short_name}] ` : ''}${selectedSchool.name_en}`
                      : '選擇學校 — 中文 / 英文 / 簡稱'}
                  </span>
                  <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  // CMDK does its own normalize+match on the value string we
                  // return from `value`. We concatenate every searchable field
                  // there so a query like "哈佛", "Harvard", or "HU" all hit.
                  filter={(value, search) => {
                    const v = value.toLowerCase()
                    const q = search.trim().toLowerCase()
                    return v.includes(q) ? 1 : 0
                  }}
                >
                  <CommandInput placeholder="輸入中文 / 英文 / 簡稱搜尋" />
                  <CommandList>
                    <CommandEmpty>沒有符合的學校</CommandEmpty>
                    <CommandGroup>
                      {schools.map((s) => {
                        const country =
                          COUNTRY_LABELS[s.country as keyof typeof COUNTRY_LABELS] ?? s.country
                        // Pack every searchable field into the value so cmdk
                        // can match on any of them. The visible text in the
                        // row is rendered via children below, so this string
                        // is invisible — order doesn't matter.
                        const haystack = [s.name_zh ?? '', s.name_en, s.short_name ?? '', country]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <CommandItem
                            key={s.id}
                            value={haystack}
                            onSelect={() => {
                              setSchoolId(s.id)
                              setProgramId('__none__')
                              setSchoolPickerOpen(false)
                            }}
                          >
                            <Check
                              size={14}
                              className={cn(
                                'mr-2 shrink-0',
                                schoolId === s.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <span className="flex-1 truncate">
                              {s.short_name ? (
                                <span className="mr-1.5 text-xs text-muted-foreground">
                                  {s.short_name}
                                </span>
                              ) : null}
                              {s.name_en}
                              {s.name_zh ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  {s.name_zh}
                                </span>
                              ) : null}
                            </span>
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                              {country}
                            </span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
