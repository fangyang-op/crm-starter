import { z } from 'zod'

export const REFERRER_TYPE_VALUES = ['individual', 'organization', 'school', 'partner'] as const

export const REFERRER_TYPE_LABELS: Record<(typeof REFERRER_TYPE_VALUES)[number], string> = {
  individual: '個人',
  organization: '機構',
  school: '學校',
  partner: '合作夥伴',
}

export const referrerSchema = z.object({
  name: z.string().min(1, '請填寫姓名').max(200),
  type: z.enum(REFERRER_TYPE_VALUES),
  contact_email: z
    .string()
    .max(255)
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'email 格式錯誤'),
  contact_phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean(),
})

export type ReferrerInput = z.infer<typeof referrerSchema>
