import { Pencil, Plus } from 'lucide-react'

import { CreateDealDialog } from '@/components/students/create-deal-dialog'
import { EditDealDialog } from '@/components/students/edit-deal-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PAYMENT_STATUS_VALUES, SPLIT_ROLE_LABELS } from '@/lib/validators/deal'
import { createClient } from '@/lib/supabase/server'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '未收',
  partial: '部分',
  paid: '已付清',
}

type Props = {
  studentId: string
  studentName: string
  defaultConsultantId: string | null
  canCreate: boolean
  canEdit: boolean
}

export async function StudentDeals({
  studentId,
  studentName,
  defaultConsultantId,
  canCreate,
  canEdit,
}: Props) {
  const supabase = createClient()

  const [
    { data: deals },
    { data: plans },
    { data: addons },
    { data: profiles },
    { data: referrers },
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('*, plan:service_plans!inner(code, name)')
      .eq('student_id', studentId)
      .order('signed_at', { ascending: false }),
    supabase
      .from('service_plans')
      .select(
        'id, code, name, base_price, currency, included_school_count, included_word_quota, is_active',
      )
      .eq('is_active', true)
      .order('display_order'),
    supabase.from('addon_pricing').select('type, unit_price, is_active').eq('is_active', true),
    supabase
      .from('profiles')
      .select('id, full_name, display_name')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('referrers').select('id, name').eq('is_active', true).order('name'),
  ])

  const consultants = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name || p.full_name,
  }))
  const referrerOptions = (referrers ?? []).map((r) => ({ id: r.id, name: r.name }))

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))
  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]))

  const extraSchoolPrice = Number(addons?.find((a) => a.type === 'extra_school')?.unit_price ?? 0)
  const extraWordPricePer1000 = Number(
    addons?.find((a) => a.type === 'extra_word_per_1000')?.unit_price ?? 0,
  )

  // Fetch splits for each deal
  const dealIds = (deals ?? []).map((d) => d.id)
  const { data: splits } =
    dealIds.length > 0
      ? await supabase.from('deal_commission_splits').select('*').in('deal_id', dealIds)
      : { data: [] as Array<Record<string, unknown>> }
  const splitsByDeal = new Map<string, typeof splits>()
  for (const s of (splits ?? []) as Array<Record<string, unknown>>) {
    const did = s.deal_id as string
    const arr = splitsByDeal.get(did) ?? ([] as never)
    arr.push(s as never)
    splitsByDeal.set(did, arr)
  }

  const createButton = canCreate ? (
    <CreateDealDialog
      studentId={studentId}
      studentName={studentName}
      defaultConsultantId={defaultConsultantId}
      plans={
        (plans ?? []).map((p) => ({
          ...p,
          base_price: Number(p.base_price),
        })) as never
      }
      consultants={consultants}
      referrers={referrerOptions}
      extraSchoolPrice={extraSchoolPrice}
      extraWordPricePer1000={extraWordPricePer1000}
      trigger={
        <Button>
          <Plus size={16} className="mr-1.5" />
          建立成交
        </Button>
      }
    />
  ) : null

  if (!deals || deals.length === 0) {
    return (
      <EmptyState
        title="尚無成交紀錄"
        description="點下方按鈕建立第一筆成交。系統會自動扣方案內含字數、寫帳本、推送狀態到「已成交」。"
        action={createButton}
      />
    )
  }

  return (
    <div className="space-y-4">
      {canCreate ? <div className="flex justify-end">{createButton}</div> : null}
      {deals.map((d) => {
        const dealSplits = (splitsByDeal.get(d.id) ?? []) as Array<{
          id: string
          role_in_deal: string
          recipient_user_id: string | null
          recipient_referrer_id: string | null
          percentage: number
          amount: number
          notes: string | null
        }>
        return (
          <Card key={d.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {(d.plan as { name: string } | null)?.name ?? '未知方案'}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  簽約 {d.signed_at}
                  {d.contract_no ? ` · ${d.contract_no}` : ''}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <div className="text-xl font-bold tabular-nums">
                    {d.currency} {Number(d.final_amount).toLocaleString('zh-TW')}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {PAYMENT_STATUS_LABELS[d.payment_status] ?? d.payment_status}
                  </Badge>
                </div>
                {canEdit ? (
                  <EditDealDialog
                    dealId={d.id}
                    studentId={studentId}
                    initial={{
                      signed_at: d.signed_at,
                      contract_no: d.contract_no,
                      payment_status: d.payment_status as (typeof PAYMENT_STATUS_VALUES)[number],
                      discount_reason: d.discount_reason,
                      notes: d.notes,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="編輯成交">
                        <Pencil size={14} />
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>
                  基礎 {d.currency} {Number(d.base_amount).toLocaleString('zh-TW')}
                </span>
                <span>
                  + 加購 {d.currency} {Number(d.addon_amount).toLocaleString('zh-TW')}
                </span>
                <span>
                  − 優惠 {d.currency} {Number(d.discount_amount).toLocaleString('zh-TW')}
                </span>
              </div>
              {d.extra_school_count > 0 || d.extra_word_quota > 0 ? (
                <div className="text-xs text-muted-foreground">
                  加購學校 {d.extra_school_count} · 加購字數{' '}
                  {Number(d.extra_word_quota).toLocaleString('zh-TW')}
                </div>
              ) : null}
              {dealSplits.length > 0 ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="mb-2 text-xs text-muted-foreground">績效拆分</div>
                  <div className="space-y-1 text-xs">
                    {dealSplits.map((s) => {
                      const recipient = s.recipient_user_id
                        ? (profileMap.get(s.recipient_user_id) ?? '—')
                        : s.recipient_referrer_id
                          ? (referrerMap.get(s.recipient_referrer_id) ?? '—')
                          : '—'
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <span>
                            {SPLIT_ROLE_LABELS[s.role_in_deal as keyof typeof SPLIT_ROLE_LABELS] ??
                              s.role_in_deal}{' '}
                            · {recipient}
                          </span>
                          <span className="tabular-nums">
                            {s.percentage}% ·{' '}
                            <span className="text-muted-foreground">
                              {d.currency} {Number(s.amount).toLocaleString('zh-TW')}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {d.discount_reason ? (
                <p className="text-xs text-muted-foreground">優惠原因:{d.discount_reason}</p>
              ) : null}
              {d.notes ? <p className="whitespace-pre-wrap text-xs">{d.notes}</p> : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
