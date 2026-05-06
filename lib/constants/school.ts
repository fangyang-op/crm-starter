export const COUNTRY_VALUES = ['US', 'UK', 'CA', 'AU', 'Other'] as const

export const COUNTRY_LABELS: Record<(typeof COUNTRY_VALUES)[number], string> = {
  US: '美國',
  UK: '英國',
  CA: '加拿大',
  AU: '澳洲',
  Other: '其他',
}

export const DEGREE_LEVEL_VALUES = [
  'bachelor',
  'master',
  'phd',
  'certificate',
  'language',
  'other',
] as const

export const DEGREE_LEVEL_LABELS: Record<(typeof DEGREE_LEVEL_VALUES)[number], string> = {
  bachelor: '學士',
  master: '碩士',
  phd: '博士',
  certificate: '證書 / Diploma',
  language: '語言課程',
  other: '其他',
}
