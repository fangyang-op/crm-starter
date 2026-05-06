import { z } from 'zod'

export const PAYMENT_STATUS_VALUES = ['pending', 'partial', 'paid'] as const
export const SPLIT_ROLE_VALUES = ['primary_consultant', 'referrer', 'manager_bonus'] as const

export const SPLIT_ROLE_LABELS: Record<(typeof SPLIT_ROLE_VALUES)[number], string> = {
  primary_consultant: '主要顧問',
  referrer: '轉介人',
  manager_bonus: '主管獎金',
}

export const dealSplitSchema = z
  .object({
    role_in_deal: z.enum(SPLIT_ROLE_VALUES),
    recipient_user_id: z.string().uuid().nullable().optional(),
    recipient_referrer_id: z.string().uuid().nullable().optional(),
    percentage: z.number().min(0).max(100),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine((s) => Boolean(s.recipient_user_id) !== Boolean(s.recipient_referrer_id), {
    message: '必須二擇一指定 recipient',
  })

export const dealSchema = z
  .object({
    student_id: z.string().uuid(),
    plan_id: z.string().uuid('請選擇方案'),
    extra_school_count: z.number().int().min(0).max(99),
    extra_word_quota: z.number().int().min(0).max(1_000_000),
    discount_amount: z.number().min(0).max(99_999_999),
    discount_reason: z.string().max(500).nullable().optional(),
    signed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式為 YYYY-MM-DD'),
    contract_no: z.string().max(100).nullable().optional(),
    payment_status: z.enum(PAYMENT_STATUS_VALUES),
    notes: z.string().max(2000).nullable().optional(),
    splits: z.array(dealSplitSchema).min(1, '至少要有一筆拆分'),
  })
  .refine(
    (d) => {
      const main = d.splits
        .filter((s) => s.role_in_deal !== 'manager_bonus')
        .reduce((sum, s) => sum + s.percentage, 0)
      return Math.abs(main - 100) < 0.01
    },
    { message: '主拆分加總必須等於 100%', path: ['splits'] },
  )

export type DealInput = z.infer<typeof dealSchema>
export type DealSplitInput = z.infer<typeof dealSplitSchema>

/**
 * Editable fields in update_deal (migration 0010). Excludes anything that
 * would cascade to amounts / splits / ledger.
 */
export const dealEditSchema = z.object({
  signed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式為 YYYY-MM-DD'),
  contract_no: z.string().max(100).nullable().optional(),
  payment_status: z.enum(PAYMENT_STATUS_VALUES),
  discount_reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type DealEditInput = z.infer<typeof dealEditSchema>
