import Link from 'next/link'

import { Plus } from 'lucide-react'

import { SchoolFormDialog } from '@/components/schools/school-form-dialog'
import { Badge } from '@/components/ui/badge'
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
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { COUNTRY_LABELS, COUNTRY_VALUES } from '@/lib/constants/school'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 30

type SearchParams = {
  q?: string
  country?: string
  page?: string
}

export const metadata = { title: '學校 — 留學代辦 CRM' }

export default async function SchoolsListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const canCreate = me ? isManagerOrAdmin(me.role as UserRole) : false

  const page = Math.max(1, Number(searchParams.page ?? 1))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('schools')
    .select(
      'id, name_en, name_zh, short_name, country, state_or_region, city, ranking_qs, ranking_us_news, is_partner, is_active',
      { count: 'exact' },
    )
    .order('country')
    .order('ranking_qs', { ascending: true, nullsFirst: false })
    .order('name_en')
    .range(from, to)

  const q = searchParams.q?.trim()
  if (q) {
    const like = `%${q}%`
    query = query.or(`name_en.ilike.${like},name_zh.ilike.${like},short_name.ilike.${like}`)
  }

  const country = searchParams.country?.trim()
  if (country && (COUNTRY_VALUES as readonly string[]).includes(country)) {
    query = query.eq('country', country)
  }

  const { data: schools, count, error } = await query

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">學校</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} 所學校{q || country ? ` · 已套用篩選` : ''}
          </p>
        </div>
        {canCreate ? (
          <SchoolFormDialog
            mode="create"
            trigger={
              <Button>
                <Plus className="mr-1.5" size={16} />
                新增學校
              </Button>
            }
          />
        ) : null}
      </header>

      <form action="/schools" method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            搜尋
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="英文 / 中文 / 簡稱"
            className="w-72"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="country" className="text-xs text-muted-foreground">
            國家
          </label>
          <select
            id="country"
            name="country"
            defaultValue={country ?? ''}
            className="inline-flex h-10 w-40 items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部國家</option>
            {COUNTRY_VALUES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          搜尋
        </Button>
        {(q || country) && (
          <Button asChild variant="ghost">
            <Link href="/schools">清除</Link>
          </Button>
        )}
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      ) : !schools || schools.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          {q || country
            ? '目前的篩選沒有結果'
            : canCreate
              ? '尚無學校資料,點右上「新增學校」開始。'
              : '尚無學校資料。'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>學校</TableHead>
                  <TableHead>國家 / 區</TableHead>
                  <TableHead className="text-right">QS</TableHead>
                  <TableHead className="text-right">US News</TableHead>
                  <TableHead>標籤</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link href={`/schools/${s.id}`} className="hover:underline">
                        <div>
                          {s.short_name ? (
                            <span className="mr-2 text-xs text-muted-foreground">
                              {s.short_name}
                            </span>
                          ) : null}
                          {s.name_en}
                        </div>
                        {s.name_zh ? (
                          <div className="text-xs font-normal text-muted-foreground">
                            {s.name_zh}
                          </div>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {COUNTRY_LABELS[s.country as keyof typeof COUNTRY_LABELS] ?? s.country}
                      {s.state_or_region ? ` / ${s.state_or_region}` : ''}
                      {s.city ? ` · ${s.city}` : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.ranking_qs ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.ranking_us_news ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.is_partner ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            合作
                          </Badge>
                        ) : null}
                        {!s.is_active ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            停用
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <Pagination currentPage={page} totalPages={totalPages} q={q} country={country} />
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
  country,
}: {
  currentPage: number
  totalPages: number
  q?: string
  country?: string
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (country) params.set('country', country)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/schools${qs ? `?${qs}` : ''}`
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
