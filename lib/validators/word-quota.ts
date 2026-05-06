import { z } from 'zod'

export const wordQuotaBonusSchema = z.object({
  student_id: z.string().uuid(),
  amount: z.number().int().min(1, '加碼數量必須 >= 1').max(1_000_000),
  description: z.string().min(1, '請填寫加碼原因').max(500),
})

export type WordQuotaBonusInput = z.infer<typeof wordQuotaBonusSchema>
