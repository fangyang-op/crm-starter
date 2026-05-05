import { z } from 'zod'

export const PLAN_COUNTRY_VALUES = ['US', 'UK', 'CA', 'AU', 'Other'] as const
export const PLAN_DEGREE_VALUES = [
  'bachelor',
  'master',
  'phd',
  'language',
  'tour',
  'other',
] as const

export const planSchema = z.object({
  code: z
    .string()
    .min(1, '請填寫方案代碼')
    .max(50)
    .regex(/^[A-Z0-9-]+$/, '只能包含大寫字母、數字與連字號'),
  name: z.string().min(1, '請填寫方案名稱').max(200),
  description: z.string().max(1000).nullable().optional(),
  base_price: z.number().min(0, '不能為負數').max(99_999_999),
  currency: z.string().min(1).max(10),
  included_school_count: z.number().int().min(0).max(99).nullable().optional(),
  included_word_quota: z.number().int().min(0).max(1_000_000).nullable().optional(),
  scope_country: z.array(z.enum(PLAN_COUNTRY_VALUES)).nullable().optional(),
  scope_degree: z.array(z.enum(PLAN_DEGREE_VALUES)).nullable().optional(),
  is_active: z.boolean(),
  display_order: z.number().int().min(0).max(9999),
})

export type PlanInput = z.infer<typeof planSchema>
