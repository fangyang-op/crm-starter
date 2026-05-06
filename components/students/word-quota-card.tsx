import { Coins, ListTree } from 'lucide-react'

import {
  WordQuotaLedgerSheet,
  type LedgerEntry,
} from '@/components/students/word-quota-ledger-sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { WordQuotaTransactionType } from '@/lib/constants/word-quota'
import { createClient } from '@/lib/supabase/server'

type Props = {
  studentId: string
  studentName: string
  canAddBonus: boolean
}

export async function WordQuotaCard({ studentId, studentName, canAddBonus }: Props) {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from('word_quota_ledger')
    .select('id, transaction_type, amount, balance_after, description, created_at, created_by')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(200)

  const balance = rows && rows.length > 0 ? Number(rows[0].balance_after) : 0

  const creatorIds = Array.from(
    new Set((rows ?? []).map((r) => r.created_by).filter((v): v is string => Boolean(v))),
  )
  const { data: profiles } =
    creatorIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, display_name').in('id', creatorIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))

  const entries: LedgerEntry[] = (rows ?? []).map((r) => ({
    id: r.id,
    transaction_type: r.transaction_type as WordQuotaTransactionType,
    amount: Number(r.amount),
    balance_after: Number(r.balance_after),
    description: r.description,
    created_at: r.created_at,
    created_by_name: r.created_by ? (profileMap.get(r.created_by) ?? null) : null,
  }))

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Coins size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">字數餘額</p>
            <p className="text-2xl font-bold tabular-nums">{balance.toLocaleString('zh-TW')}</p>
          </div>
        </div>
        <WordQuotaLedgerSheet
          studentId={studentId}
          studentName={studentName}
          balance={balance}
          entries={entries}
          canAddBonus={canAddBonus}
          trigger={
            <Button variant="outline" size="sm">
              <ListTree size={14} className="mr-1.5" />
              查看明細
            </Button>
          }
        />
      </CardContent>
    </Card>
  )
}
