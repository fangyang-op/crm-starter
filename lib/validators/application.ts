import { z } from 'zod'

import { APPLICATION_STATUS_VALUES } from '@/lib/constants/application-status'

export const applicationStatusSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUS_VALUES as [string, ...string[]]),
})
export type ApplicationStatusInput = z.infer<typeof applicationStatusSchema>

export const applicationMetaSchema = z.object({
  application_id: z.string().uuid(),
  application_round: z
    .string()
    .max(50, '申請輪次最長 50 字')
    .nullish()
    .transform((v) => v?.trim() || null),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD')
    .nullish()
    .or(z.literal('').transform(() => null)),
  application_fee: z.number().min(0, '申請費不能為負數').max(99999999, '申請費過大').nullish(),
  application_fee_paid: z.boolean().default(false),
  notes: z
    .string()
    .max(2000, '備註最長 2000 字')
    .nullish()
    .transform((v) => v?.trim() || null),
  decision_notes: z
    .string()
    .max(2000, '結果備註最長 2000 字')
    .nullish()
    .transform((v) => v?.trim() || null),
})
export type ApplicationMetaInput = z.infer<typeof applicationMetaSchema>

export const applicationPortalSchema = z.object({
  application_id: z.string().uuid(),
  portal_url: z
    .string()
    .max(500, '網址最長 500 字')
    .nullish()
    .transform((v) => v?.trim() || null),
  portal_username: z
    .string()
    .max(200, '帳號最長 200 字')
    .nullish()
    .transform((v) => v?.trim() || null),
  /** Sentinel: undefined = 不變; null = 清除; string = 設新密碼(明文,server 加密後存) */
  portal_password: z.string().max(500, '密碼最長 500 字').nullish(),
  /** Tells the action layer whether to touch the password column at all. */
  set_password: z.boolean().default(false),
  portal_notes: z
    .string()
    .max(1000, '備註最長 1000 字')
    .nullish()
    .transform((v) => v?.trim() || null),
})
export type ApplicationPortalInput = z.infer<typeof applicationPortalSchema>
