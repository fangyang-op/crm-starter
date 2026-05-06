import { z } from 'zod'

import { SCORE_TYPE_VALUES } from '@/lib/constants/score-type'

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD')
  .nullish()
  .or(z.literal('').transform(() => null))

export const scoreFormSchema = z.object({
  score_id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  score_type: z.enum(SCORE_TYPE_VALUES as [string, ...string[]]),
  total_score: z
    .string()
    .max(50, '主分數最長 50 字')
    .nullish()
    .transform((v) => v?.trim() || null),
  /** Free-form JSON; the form coerces sub-score inputs into a string-keyed
   *  record before posting. */
  sub_scores: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).nullable(),
  test_date: dateOrNull,
  expiry_date: dateOrNull,
  is_official: z.boolean().default(false),
  notes: z
    .string()
    .max(1000, '備註最長 1000 字')
    .nullish()
    .transform((v) => v?.trim() || null),
})

export type ScoreFormInput = z.infer<typeof scoreFormSchema>
