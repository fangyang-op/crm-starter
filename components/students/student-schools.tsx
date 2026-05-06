import {
  SchoolListSection,
  type ProgramOption,
  type SchoolListItem,
  type SchoolListVersion,
  type SchoolOption,
} from '@/components/students/school-list-section'
import type { Tier } from '@/lib/constants/tier'
import { createClient } from '@/lib/supabase/server'

type Props = {
  studentId: string
  canEdit: boolean
}

export async function StudentSchools({ studentId, canEdit }: Props) {
  const supabase = createClient()

  const [{ data: lists }, { data: schools }, { data: programs }, { data: applications }] =
    await Promise.all([
      supabase
        .from('school_lists')
        .select('*')
        .eq('student_id', studentId)
        .order('version_number', { ascending: false }),
      supabase
        .from('schools')
        .select('id, name_en, name_zh, short_name, country')
        .eq('is_active', true)
        .order('name_en'),
      supabase
        .from('school_programs')
        .select('id, school_id, program_name, degree_level')
        .order('program_name'),
      supabase.from('applications').select('school_id, program_id').eq('student_id', studentId),
    ])

  // Build a set of (school_id|program_id) pairs the student already has
  // applications for, so the section can show "expanded X/Y" per list.
  const expandedKeys = new Set(
    (applications ?? []).map((a) => `${a.school_id}|${a.program_id ?? ''}`),
  )

  const listIds = (lists ?? []).map((l) => l.id)
  type RawItem = {
    id: string
    school_list_id: string
    school_id: string
    program_id: string | null
    program_name_override: string | null
    tier: string
    display_order: number
    notes: string | null
  }
  const { data: items } =
    listIds.length > 0
      ? await supabase.from('school_list_items').select('*').in('school_list_id', listIds)
      : { data: [] as RawItem[] }

  const schoolMap = new Map(
    (schools ?? []).map((s) => [s.id, { name: s.name_en, country: s.country }]),
  )
  const programMap = new Map((programs ?? []).map((p) => [p.id, p.program_name]))

  const itemsByList = new Map<string, SchoolListItem[]>()
  for (const it of (items ?? []) as RawItem[]) {
    const sch = schoolMap.get(it.school_id)
    const arr = itemsByList.get(it.school_list_id) ?? []
    arr.push({
      id: it.id,
      school_id: it.school_id,
      school_name: sch?.name ?? '(未知學校)',
      school_country: sch?.country ?? '',
      program_id: it.program_id,
      program_name: it.program_id ? (programMap.get(it.program_id) ?? null) : null,
      program_name_override: it.program_name_override,
      tier: it.tier as Tier,
      display_order: it.display_order,
      notes: it.notes,
    })
    itemsByList.set(it.school_list_id, arr)
  }

  const versions: SchoolListVersion[] = (lists ?? []).map((l) => {
    const listItems = itemsByList.get(l.id) ?? []
    const expandedCount = listItems.filter((it) =>
      expandedKeys.has(`${it.school_id}|${it.program_id ?? ''}`),
    ).length
    return {
      id: l.id,
      version_number: l.version_number,
      name: l.name,
      is_locked: l.is_locked,
      is_current: l.is_current,
      created_at: l.created_at,
      items: listItems,
      expanded_count: expandedCount,
    }
  })

  const schoolOptions: SchoolOption[] = (schools ?? []).map((s) => ({
    id: s.id,
    name_en: s.name_en,
    name_zh: s.name_zh,
    short_name: s.short_name,
    country: s.country,
  }))

  const programOptions: ProgramOption[] = (programs ?? []).map((p) => ({
    id: p.id,
    school_id: p.school_id,
    program_name: p.program_name,
    degree_level: p.degree_level,
  }))

  return (
    <SchoolListSection
      studentId={studentId}
      versions={versions}
      schoolOptions={schoolOptions}
      programOptions={programOptions}
      canEdit={canEdit}
    />
  )
}
