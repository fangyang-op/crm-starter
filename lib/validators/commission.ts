import { z } from 'zod'

import { COMMISSION_STATUS_VALUES } from '@/lib/constants/commission'

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD')
  .nullish()
  .or(z.literal('').transform(() => null))

export const tuitionSchema = z.object({
  application_id: z.string().uuid(),
  tuition_amount: z.number().min(0, '學費不能為負數').max(99999999.99, '學費過大').nullable(),
  tuition_currency: z.string().min(3).max(8).default('USD'),
})
export type TuitionInput = z.infer<typeof tuitionSchema>

export const commissionUpdateSchema = z.object({
  commission_id: z.string().uuid(),
  actual_amount: z.number().min(0, '實收金額不能為負數').max(99999999.99, '金額過大').nullable(),
  status: z.enum(COMMISSION_STATUS_VALUES),
  invoiced_at: dateOrNull,
  received_at: dateOrNull,
  notes: z
    .string()
    .max(2000, '備註最長 2000 字')
    .nullish()
    .transform((v) => v?.trim() || null),
})
export type CommissionUpdateInput = z.infer<typeof commissionUpdateSchema>
