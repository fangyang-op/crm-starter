export const TIER_VALUES = ['dream', 'reach', 'match', 'safety'] as const

export type Tier = (typeof TIER_VALUES)[number]

export const TIER_LABELS: Record<Tier, string> = {
  dream: '夢校',
  reach: '衝刺',
  match: '匹配',
  safety: '保底',
}

export const TIER_BADGE_CLASS: Record<Tier, string> = {
  dream: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
  reach: 'bg-orange-100 text-orange-700 border-orange-300',
  match: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  safety: 'bg-slate-100 text-slate-700 border-slate-300',
}
