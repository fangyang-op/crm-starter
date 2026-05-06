export const COMMISSION_STATUS_VALUES = ['expected', 'invoiced', 'received', 'cancelled'] as const

export type CommissionStatus = (typeof COMMISSION_STATUS_VALUES)[number]

type StatusEntry = {
  label: string
  badgeClass: string
}

export const COMMISSION_STATUS_CONFIG: Record<CommissionStatus, StatusEntry> = {
  expected: {
    label: '預期',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  invoiced: {
    label: '已開立',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  received: {
    label: '已入帳',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  cancelled: {
    label: '已取消',
    badgeClass: 'bg-zinc-100 text-zinc-500 border-zinc-300',
  },
}
