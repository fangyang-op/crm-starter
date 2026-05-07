import { z } from 'zod'

export const RELATION_VALUES = ['父親', '母親', '監護人', '親戚', '其他'] as const
export type ContactRelation = (typeof RELATION_VALUES)[number]

// Phone normalization happens in actions.ts before insert/update, not here —
// keeping zod input/output types identical so react-hook-form's Control<T>
// stays happy. See lib/utils/phone.ts.
export const studentContactSchema = z.object({
  relation: z.enum(RELATION_VALUES),
  name: z.string().min(1, '請填寫姓名').max(100),
  phone: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  email: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'email 格式錯誤'),
  line_id: z
    .string()
    .max(50)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  is_primary_contact: z.boolean().optional().default(false),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
})

export type StudentContactInput = z.infer<typeof studentContactSchema>

export type ContactActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
