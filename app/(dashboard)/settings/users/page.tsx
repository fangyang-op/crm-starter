import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ChevronRight } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isAdmin, ROLE_LABELS, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '用戶管理 — 留學代辦 CRM' }

export default async function UsersListPage() {
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

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, role')
    .order('full_name', { ascending: true })

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">用戶管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profiles?.length ?? 0} 位帳號 · 重置密碼後請以安全管道告知對方
        </p>
      </header>

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
                <TableHead className="w-[140px]">角色</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.display_name || p.full_name}</div>
                    {p.display_name ? (
                      <div className="text-xs text-muted-foreground">{p.full_name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ROLE_LABELS[p.role as UserRole] ?? p.role}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
