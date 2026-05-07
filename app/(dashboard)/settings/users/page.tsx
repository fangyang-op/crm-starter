import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ChevronRight, Plus } from 'lucide-react'

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
import { DEPARTMENT_LABELS, DEPARTMENT_VALUES, type Department } from '@/lib/constants/department'
import { isAdmin, ROLE_LABELS, type UserRole } from '@/lib/constants/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '用戶管理 — 放洋全端 CRM 平台' }

const ROLE_VALUES: UserRole[] = ['consultant', 'manager_frontend', 'manager_backend', 'admin']

type SearchParams = {
  q?: string
  role?: string
  department?: string
  active?: string
}

export default async function UsersListPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || !isAdmin(me.role as UserRole)) redirect('/')

  let query = supabase
    .from('profiles')
    .select('id, full_name, display_name, email, role, department, is_active')

  const q = searchParams.q?.trim()
  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,display_name.ilike.%${q}%`)
  }
  if (searchParams.role && ROLE_VALUES.includes(searchParams.role as UserRole)) {
    query = query.eq('role', searchParams.role as UserRole)
  }
  if ((DEPARTMENT_VALUES as readonly string[]).includes(searchParams.department ?? '')) {
    // 'operations' value isn't in the regenerated types yet — cast through never.
    query = query.eq('department', searchParams.department as never)
  }
  if (searchParams.active === 'true') query = query.eq('is_active', true)
  else if (searchParams.active === 'false') query = query.eq('is_active', false)

  const { data: profiles, error } = await query.order('full_name', { ascending: true })

  // Fetch last_sign_in_at via admin API (auth.users isn't queryable through
  // the public Supabase client). One paginated call covers everyone in
  // small-team CRM scope. listUsers caps at 1000 by default — fine for now.
  const lastSignInMap = new Map<string, string | null>()
  try {
    const admin = createAdminClient()
    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 200 })
    for (const u of authList?.users ?? []) {
      lastSignInMap.set(u.id, u.last_sign_in_at ?? null)
    }
  } catch {
    // Best-effort: if admin list fails, fall back to "—" everywhere.
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">用戶管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profiles?.length ?? 0} 位帳號 · 重置密碼後請以安全管道告知對方
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/users/new">
            <Plus className="mr-1.5" size={16} />
            新增帳號
          </Link>
        </Button>
      </header>

      <form action="/settings/users" method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            搜尋
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="姓名 / Email"
            className="w-64"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="role" className="text-xs text-muted-foreground">
            角色
          </label>
          <select
            id="role"
            name="role"
            defaultValue={searchParams.role ?? ''}
            className="inline-flex h-10 w-40 items-center rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部角色</option>
            {ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="department" className="text-xs text-muted-foreground">
            部門
          </label>
          <select
            id="department"
            name="department"
            defaultValue={searchParams.department ?? ''}
            className="inline-flex h-10 w-32 items-center rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部部門</option>
            {DEPARTMENT_VALUES.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="active" className="text-xs text-muted-foreground">
            狀態
          </label>
          <select
            id="active"
            name="active"
            defaultValue={searchParams.active ?? ''}
            className="inline-flex h-10 w-32 items-center rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部</option>
            <option value="true">啟用中</option>
            <option value="false">已停用</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          套用
        </Button>
        {(q || searchParams.role || searchParams.department || searchParams.active) && (
          <Button asChild variant="ghost">
            <Link href="/settings/users">清除</Link>
          </Button>
        )}
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[120px]">角色</TableHead>
                <TableHead className="w-[80px]">部門</TableHead>
                <TableHead className="w-[90px]">狀態</TableHead>
                <TableHead className="w-[160px]">最後登入</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((p) => {
                const lastSignIn = lastSignInMap.get(p.id) ?? null
                return (
                  <TableRow key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                    <TableCell>
                      <div className="font-medium">{p.display_name || p.full_name}</div>
                      {p.display_name ? (
                        <div className="text-xs text-muted-foreground">{p.full_name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.email}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ROLE_LABELS[p.role as UserRole] ?? p.role}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.department &&
                      (DEPARTMENT_VALUES as readonly string[]).includes(p.department)
                        ? DEPARTMENT_LABELS[p.department as Department]
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <Badge variant="secondary">啟用中</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lastSignIn
                        ? new Date(lastSignIn).toLocaleString('zh-TW', {
                            timeZone: 'Asia/Taipei',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/settings/users/${p.id}/edit`}
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        編輯
                        <ChevronRight size={14} />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
