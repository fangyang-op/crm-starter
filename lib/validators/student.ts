import { z } from 'zod'

export const LEAD_SOURCE_VALUES = [
  'self_developed',
  'marketing_dept',
  'consultant_referral',
  'external_referrer',
  'brand_introduction',
  'other',
] as const

export const TARGET_COUNTRY_VALUES = ['US', 'UK', 'CA', 'AU', 'Other'] as const
export const TARGET_DEGREE_VALUES = [
  'bachelor',
  'master',
  'phd',
  'language',
  'tour',
  'other',
] as const
export const CURRENT_DEGREE_VALUES = ['high_school', 'bachelor', 'master', 'phd', 'other'] as const

const optionalString = (max: number) => z.string().max(max).nullable().optional()

export const studentBaseSchema = z.object({
  full_name: z.string().min(1, '請填寫中文姓名').max(100),
  english_name: optionalString(100),
  email: optionalString(255).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'email 格式錯誤',
  ),
  phone: optionalString(50),
  line_id: optionalString(50),
  birth_date: optionalString(10).refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    '日期格式為 YYYY-MM-DD',
  ),

  current_school: optionalString(200),
  current_major: optionalString(200),
  current_degree: z.enum(CURRENT_DEGREE_VALUES).nullable().optional(),
  graduation_year: z.number().int().min(1980).max(2050).nullable().optional(),

  target_country: z.array(z.enum(TARGET_COUNTRY_VALUES)).nullable().optional(),
  target_degree: z.enum(TARGET_DEGREE_VALUES).nullable().optional(),
  target_major: optionalString(200),
  target_intake: optionalString(100),

  lead_source_type: z.enum(LEAD_SOURCE_VALUES),
  lead_source_user_id: z.string().uuid('UUID 格式錯誤').nullable().optional(),
  lead_source_referrer_id: z.string().uuid('UUID 格式錯誤').nullable().optional(),
  lead_source_note: optionalString(500),

  frontend_consultant_id: z.string().uuid('UUID 格式錯誤').nullable().optional(),
  backend_consultant_id: z.string().uuid('UUID 格式錯誤').nullable().optional(),

  notes: optionalString(2000),
  tags: z.array(z.string().max(50)).nullable().optional(),
})

export type StudentInput = z.infer<typeof studentBaseSchema>

export const createStudentSchema = studentBaseSchema
export const updateStudentSchema = studentBaseSchema.extend({
  id: z.string().uuid(),
})

/**
 * Convert form-friendly values (empty strings, empty arrays) into DB-friendly
 * values (null). Run this on parsed StudentInput before INSERT/UPDATE.
 */
export function toDbPayload(input: StudentInput): StudentInput {
  const out = { ...input } as Record<string, unknown>
  for (const [k, v] of Object.entries(out)) {
    if (v === '') out[k] = null
    else if (Array.isArray(v) && v.length === 0) out[k] = null
  }
  return out as StudentInput
}
