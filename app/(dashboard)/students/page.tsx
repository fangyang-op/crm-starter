import Link from 'next/link'

import { Plus, Users } from 'lucide-react'

import { StudentsListRow } from '@/components/students/students-list-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StudentStatusRow } from '@/lib/constants/student-status'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20

type SearchParams = {
  q?: string
  status?: string
  /** v1.1 §3B: status category quick-filter ('recruitment' | 'application'). */
  cat?: string
  /** v1.1 §3B: 'unassigned' = backend_consultant_id IS NULL among 已成交+. */
  backend?: string
  page?: string
}

export const metadata = { title: '學生 — 放洋全端 CRM 平台' }

export default async function StudentsListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()

  const page = Math.max(1, Number(searchParams.page ?? 1))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Pull all (active) statuses up-front: needed for the filter dropdown,
  // for translating each row's status_id to label/color, and for the changer
  // dialog options on the detail page.
  const { data: statusesRaw } = await supabase
    .from('student_statuses' as never)
    .select('id, code, label_zh, category, color_key, sort_order, is_active')
    .order('sort_order' as never, { ascending: true })
  const allStatuses = (statusesRaw ?? []) as unknown as StudentStatusRow[]
  const statusMap = new Map(allStatuses.map((s) => [s.id, s]))

  const q = searchParams.q?.trim()
  const status = searchParams.status?.trim()
  const cat = searchParams.cat?.trim()
  const backendFilter = searchParams.backend?.trim() // 'unassigned' or undefined
  const isUnassignedTab = backendFilter === 'unassigned'

  // Status filter accepts a status code (stable across renames) or status id.
  const matchedStatus = status
    ? (allStatuses.find((s) => s.code === status) ?? allStatuses.find((s) => s.id === status))
    : null

  // Pre-compute id sets for category-based filters. v1.1 §3B/3A — 待分配後端
  // means backend NULL AND status in 已成交 (closed) or 申請中 (application).
  const statusIdsByCategory = (category: string) =>
    allStatuses.filter((s) => s.category === category).map((s) => s.id)
  const recruitmentIds = statusIdsByCategory('recruitment')
  const applicationIds = statusIdsByCategory('application')
  const closedIds = statusIdsByCategory('closed')
  const postDealIds = [...closedIds, ...applicationIds]

  let query = supabase
    .from('students')
    .select(
      'id, full_name, english_name, status_id, frontend_consultant_id, backend_consultant_id, target_country, target_degree, target_intake, created_at',
      { count: 'exact' },
    )
    .is('deleted_at', null)

  if (q) {
    const like = `%${q}%`
    query = query.or(`full_name.ilike.${like},english_name.ilike.${like},email.ilike.${like}`)
  }

  if (matchedStatus) {
    query = query.eq('status_id' as never, matchedStatus.id as never)
  }

  if (cat === 'recruitment' && recruitmentIds.length > 0) {
    query = query.in('status_id' as never, recruitmentIds as never)
  } else if (cat === 'application' && applicationIds.length > 0) {
    query = query.in('status_id' as never, applicationIds as never)
  }

  if (isUnassignedTab) {
    if (postDealIds.length === 0) {
      // No 已成交+ statuses configured (shouldn't happen post-0026 seed).
      // Force an empty result by filtering on a no-match.
      query = query.eq('status_id' as never, '00000000-0000-0000-0000-000000000000' as never)
    } else {
      query = query.is('backend_consultant_id', null).in('status_id' as never, postDealIds as never)
    }
    // Spec: 越早成交的排越前面. We don't have signed_at on students, so use
    // created_at ASC as the proxy — the deal lookup below shows 成交日期 in
    // the column. Visually equivalent for the "等待多久" intent.
    query = query.order('created_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data: students, count, error } = await query

  // Count for the 待分配後端 tab badge — independent of the active filter so
  // it always reflects the live total even when viewing a different tab.
  let unassignedBackendCount = 0
  if (postDealIds.length > 0) {
    const { count: c } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .is('backend_consultant_id', null)
      .in('status_id' as never, postDealIds as never)
    unassignedBackendCount = c ?? 0
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, display_name')
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))

  // v1.1 §3B: when on the 待分配後端 tab, fetch the earliest deal signed_at
  // per visible student so the row can show 成交日期. Only fetch for the
  // current page.
  const studentIds = (students ?? []).map((s) => (s as unknown as { id: string }).id)
  const signedAtByStudent = new Map<string, string>()
  if (isUnassignedTab && studentIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('student_id, signed_at')
      .in('student_id', studentIds)
      .order('signed_at', { ascending: true })
    for (const d of (deals ?? []) as Array<{ student_id: string; signed_at: string }>) {
      // First (oldest) deal wins because the result is sorted ASC.
      if (!signedAtByStudent.has(d.student_id)) signedAtByStudent.set(d.student_id, d.signed_at)
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1

  const tabFilters: Array<{
    label: string
    href: string
    active: boolean
    badge?: number
  }> = [
    {
      label: '全部',
      href: '/students',
      active: !cat && !isUnassignedTab && !status,
    },
    {
      label: '招生中',
      href: '/students?cat=recruitment',
      active: cat === 'recruitment' && !isUnassignedTab,
    },
    {
      label: '申請中',
      href: '/students?cat=application',
      active: cat === 'application' && !isUnassignedTab,
    },
    {
      label: '待分配後端',
      href: '/students?backend=unassigned',
      active: isUnassignedTab,
      badge: unassignedBackendCount,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users size={22} className="text-primary" />
            學生專案管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} 位學生
            {q || status || cat || isUnassignedTab ? ` · 已套用篩選` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/students/new">
            <Plus className="mr-1.5" size={16} />
            新增學生
          </Link>
        </Button>
      </header>

      <nav className="flex flex-wrap gap-1.5 rounded-lg border bg-card p-1.5 shadow-sm">
        {tabFilters.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              t.active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 ? (
              <Badge
                variant="outline"
                className={cn(
                  'h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums',
                  t.active
                    ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground'
                    : 'border-amber-300 bg-amber-50 text-amber-800',
                )}
              >
                {t.badge}
              </Badge>
            ) : null}
          </Link>
        ))}
      </nav>

      <form
        action="/students"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm"
      >
        {/* Preserve the active tab when submitting the search form (otherwise
            the form would clobber `cat`/`backend`). */}
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
        {isUnassignedTab ? <input type="hidden" name="backend" value="unassigned" /> : null}
        <div className="grid gap-1.5">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            搜尋
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="中/英文姓名、email"
            className="w-72"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            狀態
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ''}
            className="inline-flex h-10 w-48 items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部狀態</option>
            {allStatuses
              .filter((s) => s.is_active)
              .map((s) => (
                <option key={s.id} value={s.code}>
                  {s.label_zh}
                </option>
              ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          搜尋
        </Button>
        {(q || status) && (
          <Button asChild variant="ghost">
            <Link
              href={
                cat
                  ? `/students?cat=${cat}`
                  : isUnassignedTab
                    ? '/students?backend=unassigned'
                    : '/students'
              }
            >
              清除
            </Link>
          </Button>
        )}
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
          載入失敗:{error.message}
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
          尚無學生資料
          {q || status || cat || isUnassignedTab
            ? '(目前的篩選沒有結果)'
            : '。點右上「新增學生」開始'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>前端顧問</TableHead>
                  <TableHead>後端顧問</TableHead>
                  <TableHead>目標</TableHead>
                  {isUnassignedTab ? <TableHead>成交日期</TableHead> : null}
                  <TableHead className="text-right">建立時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((row) => {
                  const s = row as unknown as {
                    id: string
                    full_name: string
                    english_name: string | null
                    status_id: string
                    frontend_consultant_id: string | null
                    backend_consultant_id: string | null
                    target_country: string[] | null
                    target_degree: string | null
                    target_intake: string | null
                    created_at: string
                  }
                  const status = statusMap.get(s.status_id)
                  const target =
                    [s.target_country?.join(' / '), s.target_degree, s.target_intake]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  return (
                    <StudentsListRow
                      key={s.id}
                      student={{
                        id: s.id,
                        full_name: s.full_name,
                        english_name: s.english_name,
                        status_label: status?.label_zh ?? '—',
                        status_color_key: status?.color_key ?? null,
                        frontend_consultant_name: s.frontend_consultant_id
                          ? (profileMap.get(s.frontend_consultant_id) ?? null)
                          : null,
                        backend_consultant_name: s.backend_consultant_id
                          ? (profileMap.get(s.backend_consultant_id) ?? null)
                          : null,
                        target,
                        created_at: s.created_at,
                        deal_signed_at: isUnassignedTab
                          ? (signedAtByStudent.get(s.id) ?? null)
                          : undefined,
                      }}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              q={q}
              status={status}
              cat={cat}
              backend={isUnassignedTab ? 'unassigned' : undefined}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function Pagination({
  currentPage,
  totalPages,
  q,
  status,
  cat,
  backend,
}: {
  currentPage: number
  totalPages: number
  q?: string
  status?: string
  cat?: string
  backend?: string
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (cat) params.set('cat', cat)
    if (backend) params.set('backend', backend)
    if (p > 1) params.set('page', String(p))
    const query = params.toString()
    return `/students${query ? `?${query}` : ''}`
  }
  return (
    <nav className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        第 {currentPage} 頁,共 {totalPages} 頁
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
          <Link href={buildHref(Math.max(1, currentPage - 1))}>上一頁</Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}>
          <Link href={buildHref(Math.min(totalPages, currentPage + 1))}>下一頁</Link>
        </Button>
      </div>
    </nav>
  )
}
