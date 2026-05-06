import type { Database } from '@/types/database'

export type WordQuotaTransactionType = Database['public']['Enums']['word_quota_transaction_type']

export const WORD_QUOTA_TX_LABELS: Record<WordQuotaTransactionType, string> = {
  initial: '方案內含',
  addon: '加購',
  bonus: '加碼',
  used: '文件修改',
  refund: '退回',
  adjustment: '調整',
}

export const WORD_QUOTA_TX_COLOR: Record<WordQuotaTransactionType, string> = {
  initial: 'text-emerald-700',
  addon: 'text-emerald-700',
  bonus: 'text-emerald-700',
  refund: 'text-emerald-700',
  used: 'text-destructive',
  adjustment: 'text-muted-foreground',
}
