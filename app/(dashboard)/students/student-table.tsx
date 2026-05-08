import Link from 'next/link'

import { StudentsListRow } from '@/components/students/students-list-row'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StudentStatusRow } from '@/lib/constants/student-status'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20

export type StudentTableProps = {
  page: number
  q?: string
  matchedStatus?: StudentStatusRow | null
  cat?: string
  isUnassignedTab: boolean
  recruitmentIds: string[]
  applicationIds: string[]
  postDealIds: string[]
  statusMap: Map<string, StudentStatusRow>
}

/** 學生主表格 — perf: 從原本 page.tsx 拆出來,讓外層 page (shell) 可以
 *  立刻 render header / tabs / search form,table 區塊用 Suspense 包住,
 *  資料抓完才 swap 進去。這個檔自己跑 fetch + 自己 render,不依賴 page
 *  的 closure。 */
export async function StudentTable({
  page,
  q,
  matchedStatus,
  cat,
  isUnassignedTab,
  recruitmentIds,
  applicationIds,
  postDealIds,
  statusMap,
}: StudentTableProps) {
  const supabase = createClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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
      query = query.eq('status_id' as never, '00000000-0000-0000-0000-000000000000' as never)
    } else {
      query = query.is('backend_consultant_id', null).in('status_id' as never, postDealIds as never)
    }
    query = query.order('created_at', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

  const { data: students, count, error } = await query

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, display_name')
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))

  // v1.1 §3B: 待分配後端 tab 顯示成交日期。只抓當前頁面學生的 deals。
  const studentIds = (students ?? []).map((s) => (s as unknown as { id: string }).id)
  const signedAtByStudent = new Map<string, string>()
  if (isUnassignedTab && studentIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('student_id, signed_at')
      .in('student_id', studentIds)
      .order('signed_at', { ascending: true })
    for (const d of (deals ?? []) as Array<{ student_id: string; signed_at: string }>) {
      if (!signedAtByStudent.has(d.student_id)) signedAtByStudent.set(d.student_id, d.signed_at)
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
        載入失敗:{error.message}
      </div>
    )
  }

  if (!students || students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
        尚無學生資料
        {q || matchedStatus || cat || isUnassignedTab
          ? '(目前的篩選沒有結果)'
          : '。點右上「新增學生」開始'}
      </div>
    )
  }

  return (
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
          status={matchedStatus?.code}
          cat={cat}
          backend={isUnassignedTab ? 'unassigned' : undefined}
        />
      ) : null}
    </>
  )
}

export function StudentTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <div className="flex gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-3 w-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-6 border-b px-5 py-3 last:border-0">
          {[1, 2, 3, 4, 5, 6].map((j) => (
            <div
              key={j}
              className="h-4 animate-pulse rounded bg-muted"
              style={{ width: j === 1 ? '12rem' : `${5 + (j % 3) * 2}rem` }}
            />
          ))}
        </div>
      ))}
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
