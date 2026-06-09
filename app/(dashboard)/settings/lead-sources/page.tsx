import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArrowLeft, Plus } from 'lucide-react'

import {
  LeadSourceFormDialog,
  type LeadSourceInitial,
} from '@/components/settings/lead-source-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '名單來源 — 放洋全端 CRM 平台' }

export default async function LeadSourcesPage() {
  const supabase = await createClient()
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

  const [{ data: sourcesRaw, error }, { data: referrers }] = await Promise.all([
    supabase
      .from('lead_sources' as never)
      .select('id, code, label_zh, default_referrer_id, sort_order, is_active, detail_field')
      .order('sort_order' as never, { ascending: true })
      .order('label_zh' as never, { ascending: true }),
    supabase.from('referrers').select('id, name').eq('is_active', true).order('name'),
  ])

  const sources = (sourcesRaw ?? []) as unknown as Array<LeadSourceInitial>

  const referrerOptions = (referrers ?? []).map((r) => ({ id: r.id, name: r.name }))
  const referrerMap = new Map(referrerOptions.map((r) => [r.id, r.name]))

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} className="mr-1" />
          返回設定
        </Link>
      </div>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">名單來源</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sources?.length ?? 0} 筆 · 學生新增 / 編輯時會以此為下拉選單
          </p>
        </div>
        <LeadSourceFormDialog
          mode="create"
          referrers={referrerOptions}
          trigger={
            <Button>
              <Plus size={16} className="mr-1.5" />
              新增來源
            </Button>
          }
        />
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
                <TableHead className="w-[60px]">順序</TableHead>
                <TableHead>中文名稱</TableHead>
                <TableHead>代號</TableHead>
                <TableHead>詳情欄位</TableHead>
                <TableHead>預設轉介人</TableHead>
                <TableHead className="w-[90px]">狀態</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id} className={s.is_active ? '' : 'opacity-60'}>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {s.sort_order}
                  </TableCell>
                  <TableCell className="font-medium">{s.label_zh}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.code}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.detail_field === 'referrer'
                      ? '轉介人'
                      : s.detail_field === 'internal_user'
                        ? '自己人'
                        : '無'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.default_referrer_id ? (referrerMap.get(s.default_referrer_id) ?? '—') : '—'}
                  </TableCell>
                  <TableCell>
                    {s.is_active ? (
                      <Badge variant="secondary">啟用中</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        已停用
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <LeadSourceFormDialog
                      mode="edit"
                      initial={s}
                      referrers={referrerOptions}
                      trigger={
                        <Button variant="ghost" size="sm">
                          編輯
                        </Button>
                      }
                    />
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
