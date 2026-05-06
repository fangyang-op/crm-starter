import Link from 'next/link'

import { Plus } from 'lucide-react'

import { StudentsListRow } from '@/components/students/students-list-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StudentStatusRow } from '@/lib/constants/student-status'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20

type SearchParams = {
  q?: string
  status?: string
  page?: string
}

export const metadata = { title: '學生 — 留學代辦 CRM' }

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

  let query = supabase
    .from('students')
    .select(
      'id, full_name, english_name, status_id, frontend_consultant_id, backend_consultant_id, target_country, target_degree, target_intake, created_at',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  const q = searchParams.q?.trim()
  if (q) {
    const like = `%${q}%`
    query = query.or(`full_name.ilike.${like},english_name.ilike.${like},email.ilike.${like}`)
  }

  // The filter accepts a status code (stable across renames) or status id.
  // Look up the id by code first, fall back to id directly.
  const status = searchParams.status?.trim()
  const matchedStatus = status
    ? (allStatuses.find((s) => s.code === status) ?? allStatuses.find((s) => s.id === status))
    : null
  if (matchedStatus) {
    query = query.eq('status_id' as never, matchedStatus.id as never)
  }

  const { data: students, count, error } = await query

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, display_name')
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">學生</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} 位學生{q || status ? ` · 已套用篩選` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/students/new">
            <Plus className="mr-1.5" size={16} />
            新增學生
          </Link>
        </Button>
      </header>

      <form
        action="/students"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm"
      >
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
            <Link href="/students">清除</Link>
          </Button>
        )}
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
          載入失敗:{error.message}
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
          尚無學生資料{q || status ? '(目前的篩選沒有結果)' : '。點右上「新增學生」開始'}
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
                      }}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <Pagination currentPage={page} totalPages={totalPages} q={q} status={status} />
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
}: {
  currentPage: number
  totalPages: number
  q?: string
  status?: string
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
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
