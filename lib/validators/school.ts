import { z } from 'zod'

import { COUNTRY_VALUES, DEGREE_LEVEL_VALUES } from '@/lib/constants/school'

const optionalString = (max: number) => z.string().max(max).nullable().optional()

export const schoolSchema = z.object({
  name_en: z.string().min(1, '請填寫英文名稱').max(200),
  name_zh: optionalString(200),
  short_name: optionalString(50),
  country: z.enum(COUNTRY_VALUES),
  state_or_region: optionalString(100),
  city: optionalString(100),
  website: optionalString(500),
  ranking_qs: z.number().int().min(1).max(9999).nullable().optional(),
  ranking_us_news: z.number().int().min(1).max(9999).nullable().optional(),
  is_partner: z.boolean(),
  partner_commission_rate: z.number().min(0).max(100).nullable().optional(),
  partner_notes: optionalString(2000),
  is_active: z.boolean(),
})

export type SchoolInput = z.infer<typeof schoolSchema>

export const schoolProgramSchema = z.object({
  school_id: z.string().uuid(),
  program_name: z.string().min(1, '請填寫科系名稱').max(200),
  degree_level: z.enum(DEGREE_LEVEL_VALUES),
  major_category: optionalString(100),
  application_deadline_round1: optionalString(10).refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    '日期格式為 YYYY-MM-DD',
  ),
  application_deadline_round2: optionalString(10).refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    '日期格式為 YYYY-MM-DD',
  ),
  notes: optionalString(2000),
})

export type SchoolProgramInput = z.infer<typeof schoolProgramSchema>
