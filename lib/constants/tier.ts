// Spec § 4.1: only three tiers — 衝刺 was retired (existing reach data
// migrated to match in 0028). Per spec § 4.2 colors map to:
//   dream  → 淡粉   (pink)
//   match  → 淡黃   (amber)  — renamed from 匹配 to 合適
//   safety → 淡藍   (blue)
export const TIER_VALUES = ['dream', 'match', 'safety'] as const

export type Tier = (typeof TIER_VALUES)[number]

export const TIER_LABELS: Record<Tier, string> = {
  dream: '夢幻',
  match: '合適',
  safety: '保底',
}

export const TIER_BADGE_CLASS: Record<Tier, string> = {
  dream: 'bg-pink-100 text-pink-700 border-pink-300',
  match: 'bg-amber-100 text-amber-700 border-amber-300',
  safety: 'bg-blue-100 text-blue-700 border-blue-300',
}

/** Sort order for the school list (within a list version, dream first). */
export const TIER_SORT: Record<Tier, number> = {
  dream: 1,
  match: 2,
  safety: 3,
}
