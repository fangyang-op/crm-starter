import type { Database } from '@/types/database'

export type DocumentType = Database['public']['Enums']['document_type']

export const DOC_TYPE_VALUES: DocumentType[] = ['cv', 'sop', 'lor', 'transcript', 'other']

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  cv: '履歷 CV',
  sop: '自傳 SOP',
  lor: '推薦信 LOR',
  transcript: '成績單',
  other: '其他',
}
