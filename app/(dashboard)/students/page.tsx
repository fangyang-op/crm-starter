import { Suspense } from 'react'
import Link from 'next/link'

import { Plus, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StudentStatusRow } from '@/lib/constants/student-status'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

import { StudentTable, StudentTableSkeleton } from './student-table'

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

  // perf: shell 只跑兩個必要 query —
  //   1. 全部 active 學生狀態(下拉選單 + 狀態徽章 map)
  //   2. 待分配後端 tab badge 的 count
  // 主表格資料(students + profiles + deals)獨立到 <StudentTable> 並用
  // Suspense 包住,讓 header / tabs / search form 立即 render。
  const { data: statusesRaw } = await supabase
    .from('student_statuses' as never)
    .select('id, code, label_zh, category, color_key, sort_order, is_active')
    .order('sort_order' as never, { ascending: true })
  const allStatuses = (statusesRaw ?? []) as unknown as StudentStatusRow[]
  const statusMap = new Map(allStatuses.map((s) => [s.id, s]))

  const q = searchParams.q?.trim()
  const status = searchParams.status?.trim()
  const cat = searchParams.cat?.trim()
  const backendFilter = searchParams.backend?.trim()
  const isUnassignedTab = backendFilter === 'unassigned'
  const page = Math.max(1, Number(searchParams.page ?? 1))

  const matchedStatus = status
    ? (allStatuses.find((s) => s.code === status) ?? allStatuses.find((s) => s.id === status))
    : null

  // 算 待分配後端 tab badge — 與當前 filter 無關,顯示全公司未分配總數。
  const statusIdsByCategory = (category: string) =>
    allStatuses.filter((s) => s.category === category).map((s) => s.id)
  const recruitmentIds = statusIdsByCategory('recruitment')
  const applicationIds = statusIdsByCategory('application')
  const closedIds = statusIdsByCategory('closed')
  const postDealIds = [...closedIds, ...applicationIds]

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

  // Suspense key — searchParams 變動時讓內層重新 mount + 重新顯示 skeleton,
  // 避免上一頁資料殘留閃一下。包含所有影響查詢的 param。
  const tableKey = JSON.stringify({ q, status, cat, backendFilter, page })

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users size={22} className="text-primary" />
            學生專案管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {q || status || cat || isUnassignedTab ? '已套用篩選' : '全公司學生名單'}
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

      <Suspense key={tableKey} fallback={<StudentTableSkeleton />}>
        <StudentTable
          page={page}
          q={q}
          matchedStatus={matchedStatus}
          cat={cat}
          isUnassignedTab={isUnassignedTab}
          recruitmentIds={recruitmentIds}
          applicationIds={applicationIds}
          postDealIds={postDealIds}
          statusMap={statusMap}
        />
      </Suspense>
    </div>
  )
}
