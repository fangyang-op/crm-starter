import { z } from 'zod'

import { DOC_TYPE_VALUES } from '@/lib/constants/document'

export const newMasterSchema = z.object({
  student_id: z.string().uuid(),
  doc_type: z.enum(DOC_TYPE_VALUES as [string, ...string[]]),
  title: z.string().min(1, '請填寫標題').max(200),
  description: z.string().max(1000).nullable().optional(),
})

export type NewMasterInput = z.infer<typeof newMasterSchema>

export const newMasterVersionSchema = z.object({
  master_id: z.string().uuid(),
  content: z.string().max(200_000),
  change_note: z.string().max(500).nullable().optional(),
})

export type NewMasterVersionInput = z.infer<typeof newMasterVersionSchema>

export const forkVariantSchema = z.object({
  master_id: z.string().uuid(),
  application_id: z.string().uuid('請選擇要套用的學校申請'),
  source_master_version_id: z.string().uuid(),
})

export type ForkVariantInput = z.infer<typeof forkVariantSchema>

export const newVariantVersionSchema = z.object({
  variant_id: z.string().uuid(),
  content: z.string().max(200_000),
  change_note: z.string().max(500).nullable().optional(),
})

export type NewVariantVersionInput = z.infer<typeof newVariantVersionSchema>
