import Link from 'next/link'

import { AlertTriangle, ArrowRight, LayoutDashboard, Lightbulb } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // v1.1 §3A: surface students who are 已成交+ (status category 'closed' or
  // 'application') but have no backend_consultant_id assigned. RLS already
  // narrows what each viewer sees, so non-managers will see 0 and the widget
  // self-hides — no per-role check needed here.
  const { data: targetStatuses } = await supabase
    .from('student_statuses' as never)
    .select('id')
    .in('category' as never, ['closed', 'application'] as never)
  const targetStatusIds = ((targetStatuses ?? []) as unknown as Array<{ id: string }>).map(
    (s) => s.id,
  )

  let unassignedBackendCount = 0
  if (targetStatusIds.length > 0) {
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .is('backend_consultant_id', null)
      .in('status_id' as never, targetStatusIds as never)
    unassignedBackendCount = count ?? 0
  }

  // duplicate-prevention §4: count of `duplicate_phone_override` activity_log
  // rows the viewer can see. activity_log RLS already restricts non-managers
  // to their own students' rows, so non-managers naturally see 0 in normal
  // flow — same self-hiding pattern as the widget above.
  const { count: dupOverrideCountRaw } = await supabase
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'duplicate_phone_override')
  const dupOverrideCount = dupOverrideCountRaw ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <LayoutDashboard size={22} className="text-primary" />
        儀表板
      </h1>
      <p className="text-sm text-muted-foreground">
        歡迎回來,{user?.email}。Phase 5 會在這裡放 KPI 卡與待辦清單。
      </p>

      {unassignedBackendCount > 0 ? (
        <Link
          href="/students?backend=unassigned"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm shadow-sm transition-colors hover:bg-amber-100"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="shrink-0 text-amber-600" />
            <span className="text-amber-900">
              目前尚有 <strong className="tabular-nums">{unassignedBackendCount}</strong>{' '}
              位學生尚未分配後端顧問
            </span>
          </div>
          <span className="flex items-center gap-1 text-amber-800">
            查看清單
            <ArrowRight size={14} />
          </span>
        </Link>
      ) : null}

      {dupOverrideCount > 0 ? (
        <Link
          href="/duplicate-overrides"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm shadow-sm transition-colors hover:bg-amber-100"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-amber-600" />
            <span className="text-amber-900">
              有 <strong className="tabular-nums">{dupOverrideCount}</strong>{' '}
              筆名單覆蓋了重複手機號碼,請確認
            </span>
          </div>
          <span className="flex items-center gap-1 text-amber-800">
            查看清單
            <ArrowRight size={14} />
          </span>
        </Link>
      ) : null}
    </div>
  )
}
