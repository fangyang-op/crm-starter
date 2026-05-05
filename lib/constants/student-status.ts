import type { Database } from '@/types/database'

export type StudentStatus = Database['public']['Enums']['student_status']

export type StudentStatusStage = 'recruitment' | 'closed' | 'application' | 'special'

type StatusEntry = {
  label: string
  /** Tailwind classes for the badge: bg + text + border. */
  badgeClass: string
  stage: StudentStatusStage
}

export const STUDENT_STATUS_CONFIG: Record<StudentStatus, StatusEntry> = {
  // 招生階段
  new_lead: {
    label: '新名單',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    stage: 'recruitment',
  },
  contacted: {
    label: '聯繫中',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
    stage: 'recruitment',
  },
  consulting: {
    label: '諮詢中',
    badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    stage: 'recruitment',
  },
  qualified: {
    label: '意向客戶',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-300',
    stage: 'recruitment',
  },
  disqualified: {
    label: '無效名單',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-300',
    stage: 'recruitment',
  },

  // 成交分水嶺
  closed_won: {
    label: '已成交',
    badgeClass: 'bg-emerald-500 text-white border-emerald-600',
    stage: 'closed',
  },

  // 申請階段
  onboarding: {
    label: '資料準備',
    badgeClass: 'bg-teal-100 text-teal-700 border-teal-300',
    stage: 'application',
  },
  school_selection: {
    label: '選校規劃',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    stage: 'application',
  },
  document_prep: {
    label: '書審準備',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-300',
    stage: 'application',
  },
  submitting: {
    label: '申請送出',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
    stage: 'application',
  },
  awaiting_decision: {
    label: '等待結果',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300',
    stage: 'application',
  },
  decision_making: {
    label: '錄取確認',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-300',
    stage: 'application',
  },
  pre_departure: {
    label: '入學準備',
    badgeClass: 'bg-lime-100 text-lime-700 border-lime-300',
    stage: 'application',
  },
  enrolled: {
    label: '已入學',
    badgeClass: 'bg-green-700 text-white border-green-800',
    stage: 'application',
  },

  // 特殊
  paused: {
    label: '暫緩',
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    stage: 'special',
  },
  terminated: {
    label: '退費終止',
    badgeClass: 'bg-red-100 text-red-700 border-red-300',
    stage: 'special',
  },
}

export const STUDENT_STATUS_VALUES = Object.keys(STUDENT_STATUS_CONFIG) as StudentStatus[]
