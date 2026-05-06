// Status configuration is now driven by the public.student_statuses table
// (admin-maintained). This file holds the static fallbacks and the color
// preset map that resolves color_key (stored in DB) → tailwind classes.
//
// History: pre-0026 this file owned the canonical status enum + labels.
// After 0026 the labels live in DB; we keep the codes here only as a string
// union so payload parsers (e.g. timeline event keys) and old activity_log
// rows still type-check.

export type StudentStatusCode =
  | 'new_lead'
  | 'contacted'
  | 'consulting'
  | 'qualified'
  | 'disqualified'
  | 'closed_won'
  | 'onboarding'
  | 'school_selection'
  | 'document_prep'
  | 'submitting'
  | 'awaiting_decision'
  | 'decision_making'
  | 'pre_departure'
  | 'enrolled'
  | 'paused'
  | 'terminated'

/** Stage groupings used by the form / timeline filter chips. */
export type StudentStatusStage = 'recruitment' | 'closed' | 'application' | 'special'

export const STAGE_LABELS: Record<StudentStatusStage, string> = {
  recruitment: '招生',
  closed: '成交',
  application: '申請',
  special: '特殊',
}

/** Single status row as the UI consumes it (fetched from student_statuses). */
export type StudentStatusRow = {
  id: string
  code: string
  label_zh: string
  category: StudentStatusStage
  color_key: string
  sort_order: number
  is_active: boolean
}

/**
 * Color presets — color_key (stored on student_statuses) maps to a tailwind
 * class triplet. Keep this list aligned with whatever options the
 * settings/student-statuses dialog offers admins.
 */
export const COLOR_PRESETS: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-300',
  gray: 'bg-gray-100 text-gray-500 border-gray-300',
  blue: 'bg-blue-100 text-blue-700 border-blue-300',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  violet: 'bg-violet-100 text-violet-700 border-violet-300',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  teal: 'bg-teal-100 text-teal-700 border-teal-300',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  purple: 'bg-purple-100 text-purple-700 border-purple-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
  amber: 'bg-amber-100 text-amber-700 border-amber-300',
  orange: 'bg-orange-100 text-orange-700 border-orange-300',
  lime: 'bg-lime-100 text-lime-700 border-lime-300',
  green: 'bg-green-100 text-green-700 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  red: 'bg-red-100 text-red-700 border-red-300',
  rose: 'bg-rose-100 text-rose-700 border-rose-300',
  pink: 'bg-pink-100 text-pink-700 border-pink-300',
}

export const COLOR_KEY_VALUES = Object.keys(COLOR_PRESETS)

/** Resolve a color_key → tailwind class string. Falls back to 'slate'. */
export function statusBadgeClass(colorKey: string | null | undefined): string {
  if (!colorKey) return COLOR_PRESETS.slate
  return COLOR_PRESETS[colorKey] ?? COLOR_PRESETS.slate
}
