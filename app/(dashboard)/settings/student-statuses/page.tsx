import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArrowLeft, Plus } from 'lucide-react'

import {
  StudentStatusFormDialog,
  type StudentStatusInitial,
} from '@/components/settings/student-status-form-dialog'
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
import { STAGE_LABELS, statusBadgeClass } from '@/lib/constants/student-status'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '學生狀態 — 放洋全端 CRM 平台' }

export default async function StudentStatusesPage() {
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

  const { data: rowsRaw, error } = await supabase
    .from('student_statuses' as never)
    .select('id, code, label_zh, category, color_key, sort_order, is_active')
    .order('sort_order' as never, { ascending: true })
    .order('label_zh' as never, { ascending: true })

  const statuses = (rowsRaw ?? []) as unknown as StudentStatusInitial[]

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
          <h1 className="text-2xl font-semibold">學生狀態</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statuses.length} 個 · 影響學生卡片徽章、篩選器、狀態變更選單
          </p>
        </div>
        <StudentStatusFormDialog
          mode="create"
          trigger={
            <Button>
              <Plus size={16} className="mr-1.5" />
              新增狀態
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
                <TableHead>名稱</TableHead>
                <TableHead className="w-[100px]">分類</TableHead>
                <TableHead className="w-[140px]">代號</TableHead>
                <TableHead className="w-[90px]">狀態</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id} className={s.is_active ? '' : 'opacity-60'}>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {s.sort_order}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                        statusBadgeClass(s.color_key),
                      )}
                    >
                      {s.label_zh}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {STAGE_LABELS[s.category]}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.code}
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
                    <StudentStatusFormDialog
                      mode="edit"
                      initial={s}
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
