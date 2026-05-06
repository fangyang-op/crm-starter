import type { Database } from '@/types/database'

export type ApplicationStatus = Database['public']['Enums']['application_status']

type StatusEntry = {
  label: string
  badgeClass: string
  /** Used to sort columns in the kanban view. */
  order: number
}

export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, StatusEntry> = {
  pending_send: {
    label: '待寄出',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    order: 10,
  },
  submitted: {
    label: '已送出',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
    order: 20,
  },
  docs_required: {
    label: '補件中',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300',
    order: 30,
  },
  interview: {
    label: '面試中',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-300',
    order: 40,
  },
  waitlisted: {
    label: '候補',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-300',
    order: 50,
  },
  admitted: {
    label: '錄取',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    order: 60,
  },
  rejected: {
    label: '拒絕',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-300',
    order: 70,
  },
  declined_by_us: {
    label: '放棄錄取',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    order: 80,
  },
  enrolled: {
    label: '確定入學',
    badgeClass: 'bg-green-700 text-white border-green-800',
    order: 90,
  },
}

export const APPLICATION_STATUS_VALUES = (
  Object.keys(APPLICATION_STATUS_CONFIG) as ApplicationStatus[]
).sort((a, b) => APPLICATION_STATUS_CONFIG[a].order - APPLICATION_STATUS_CONFIG[b].order)
