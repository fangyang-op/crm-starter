import type { Database } from '@/types/database'

export type ScoreType = Database['public']['Enums']['score_type']

export type SubScoreField = {
  /** JSONB key */
  key: string
  /** Chinese label shown in the UI */
  label: string
  /** Allowed numeric range, used to hint the input but NOT enforced (some
   *  exams have weird half-points; we keep the input lenient and rely on
   *  the consultant). */
  hint?: string
}

type ScoreTypeEntry = {
  label: string
  /** Fields rendered in the form for sub_scores. Empty array means no sub. */
  subFields: SubScoreField[]
  /** Placeholder for the total score input. */
  totalPlaceholder: string
  /** Tailwind classes for the badge. */
  badgeClass: string
}

export const SCORE_TYPE_CONFIG: Record<ScoreType, ScoreTypeEntry> = {
  gpa: {
    label: 'GPA',
    subFields: [],
    totalPlaceholder: '例:3.85 / 4.0',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  toefl: {
    label: 'TOEFL',
    subFields: [
      { key: 'reading', label: 'Reading', hint: '0-30' },
      { key: 'listening', label: 'Listening', hint: '0-30' },
      { key: 'speaking', label: 'Speaking', hint: '0-30' },
      { key: 'writing', label: 'Writing', hint: '0-30' },
    ],
    totalPlaceholder: '例:105',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  ielts: {
    label: 'IELTS',
    subFields: [
      { key: 'listening', label: 'Listening', hint: '0-9' },
      { key: 'reading', label: 'Reading', hint: '0-9' },
      { key: 'writing', label: 'Writing', hint: '0-9' },
      { key: 'speaking', label: 'Speaking', hint: '0-9' },
    ],
    totalPlaceholder: '例:7.5',
    badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  },
  gre: {
    label: 'GRE',
    subFields: [
      { key: 'verbal', label: 'Verbal', hint: '130-170' },
      { key: 'quantitative', label: 'Quant', hint: '130-170' },
      { key: 'awa', label: 'AWA', hint: '0-6' },
    ],
    totalPlaceholder: '例:325',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-300',
  },
  gmat: {
    label: 'GMAT',
    subFields: [
      { key: 'verbal', label: 'Verbal' },
      { key: 'quantitative', label: 'Quant' },
      { key: 'awa', label: 'AWA' },
      { key: 'integrated_reasoning', label: 'IR' },
    ],
    totalPlaceholder: '例:710',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
  },
  sat: {
    label: 'SAT',
    subFields: [
      { key: 'reading_writing', label: 'R&W', hint: '200-800' },
      { key: 'math', label: 'Math', hint: '200-800' },
    ],
    totalPlaceholder: '例:1500',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  duolingo: {
    label: 'Duolingo',
    subFields: [],
    totalPlaceholder: '例:135',
    badgeClass: 'bg-lime-100 text-lime-700 border-lime-300',
  },
  other: {
    label: '其他',
    subFields: [],
    totalPlaceholder: '例:A2 / B1 / 其他自由格式',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
}

export const SCORE_TYPE_VALUES = Object.keys(SCORE_TYPE_CONFIG) as ScoreType[]
