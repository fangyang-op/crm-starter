import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArrowLeft, Plus } from 'lucide-react'

import { PlanFormDialog } from '@/components/plans/plan-form-dialog'
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

export const metadata = { title: '服務方案 — 放洋全端 CRM 平台' }

export default async function PlansPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !isAdmin(me.role as UserRole)) redirect('/settings')

  const { data: plans, error } = await supabase
    .from('service_plans')
    .select('*')
    .order('display_order')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
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
          <h1 className="text-2xl font-semibold">服務方案</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plans?.length ?? 0} 套方案</p>
        </div>
        <PlanFormDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-1.5" size={16} />
              新增方案
            </Button>
          }
        />
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      ) : !plans || plans.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          尚無方案。點右上「新增方案」開始。
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">代碼</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead className="text-right">基礎價</TableHead>
                <TableHead className="text-right">含校數</TableHead>
                <TableHead className="text-right">含字數</TableHead>
                <TableHead>適用</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.currency} {Number(p.base_price).toLocaleString('zh-TW')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.included_school_count ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.included_word_quota?.toLocaleString('zh-TW') ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[p.scope_country?.join('/'), p.scope_degree?.join('/')]
                      .filter(Boolean)
                      .join(' · ') || '不限'}
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
                  <TableCell className="text-right">
                    <PlanFormDialog
                      mode="edit"
                      initial={{
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        description: p.description,
                        base_price: Number(p.base_price),
                        currency: p.currency,
                        included_school_count: p.included_school_count,
                        included_word_quota: p.included_word_quota,
                        scope_country: p.scope_country as never,
                        scope_degree: p.scope_degree as never,
                        is_active: p.is_active,
                        display_order: p.display_order,
                      }}
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
