import Link from 'next/link'

import { Plus } from 'lucide-react'

import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  STUDENT_STATUS_CONFIG,
  STUDENT_STATUS_VALUES,
  type StudentStatus,
} from '@/lib/constants/student-status'
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

  let query = supabase
    .from('students')
    .select(
      'id, full_name, english_name, status, frontend_consultant_id, backend_consultant_id, target_country, target_degree, target_intake, created_at',
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

  const status = searchParams.status?.trim()
  if (status && (STUDENT_STATUS_VALUES as readonly string[]).includes(status)) {
    query = query.eq('status', status as StudentStatus)
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

      <form action="/students" method="get" className="flex flex-wrap items-end gap-3">
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
            {STUDENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STUDENT_STATUS_CONFIG[s].label}
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
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          尚無學生資料{q || status ? '(目前的篩選沒有結果)' : '。點右上「新增學生」開始'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border">
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
                {students.map((s) => {
                  const target =
                    [s.target_country?.join(' / '), s.target_degree, s.target_intake]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link href={`/students/${s.id}`} className="hover:underline">
                          {s.full_name}
                          {s.english_name ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {s.english_name}
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.frontend_consultant_id
                          ? (profileMap.get(s.frontend_consultant_id) ?? '—')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.backend_consultant_id
                          ? (profileMap.get(s.backend_consultant_id) ?? '—')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{target}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString('zh-TW', {
                          timeZone: 'Asia/Taipei',
                        })}
                      </TableCell>
                    </TableRow>
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
