import { z } from 'zod'

import { TIER_VALUES } from '@/lib/constants/tier'

export const newSchoolListSchema = z.object({
  student_id: z.string().uuid(),
  name: z.string().min(1, '請填寫版本名稱').max(100),
  copy_from_list_id: z.string().uuid().nullable().optional(),
})

export type NewSchoolListInput = z.infer<typeof newSchoolListSchema>

export const addSchoolListItemSchema = z.object({
  school_list_id: z.string().uuid(),
  school_id: z.string().uuid('請選擇學校'),
  program_id: z.string().uuid().nullable().optional(),
  program_name_override: z.string().max(200).nullable().optional(),
  tier: z.enum(TIER_VALUES),
  notes: z.string().max(1000).nullable().optional(),
})

export type AddSchoolListItemInput = z.infer<typeof addSchoolListItemSchema>

export const updateSchoolListItemSchema = z.object({
  tier: z.enum(TIER_VALUES),
  display_order: z.number().int().min(0).max(999),
  notes: z.string().max(1000).nullable().optional(),
})

export type UpdateSchoolListItemInput = z.infer<typeof updateSchoolListItemSchema>
