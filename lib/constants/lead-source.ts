export const LEAD_SOURCE_DETAIL_FIELD_VALUES = ['none', 'internal_user', 'referrer'] as const

export type LeadSourceDetailField = (typeof LEAD_SOURCE_DETAIL_FIELD_VALUES)[number]
