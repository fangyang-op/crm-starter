import Link from 'next/link'

import { ArrowLeft, Plus } from 'lucide-react'

import { ReferrerFormDialog } from '@/components/referrers/referrer-form-dialog'
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
import { REFERRER_TYPE_LABELS } from '@/lib/validators/referrer'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '轉介人 — 放洋全端 CRM 平台' }

export default async function ReferrersPage() {
  const supabase = await createClient()
  const { data: referrers, error } = await supabase
    .from('referrers')
    .select(
      'id, name, type, contact_email, contact_phone, default_split_percent, notes, is_active, created_at',
    )
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
          <h1 className="text-2xl font-semibold">轉介人</h1>
          <p className="mt-1 text-sm text-muted-foreground">{referrers?.length ?? 0} 位</p>
        </div>
        <ReferrerFormDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-1.5" size={16} />
              新增轉介人
            </Button>
          }
        />
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          載入失敗:{error.message}
        </div>
      ) : !referrers || referrers.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          尚無轉介人。點右上「新增轉介人」開始。
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>電話</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrers.map((r) => {
                const typeLabel =
                  REFERRER_TYPE_LABELS[r.type as keyof typeof REFERRER_TYPE_LABELS] ?? r.type
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm">{typeLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.contact_email ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.contact_phone ?? '—'}
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge variant="secondary">啟用中</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReferrerFormDialog
                        mode="edit"
                        initial={{
                          id: r.id,
                          name: r.name,
                          type: r.type as never,
                          contact_email: r.contact_email,
                          contact_phone: r.contact_phone,
                          default_split_percent:
                            (r as { default_split_percent?: number | null })
                              .default_split_percent ?? null,
                          notes: r.notes,
                          is_active: r.is_active,
                        }}
                        trigger={
                          <Button variant="ghost" size="sm">
                            編輯
                          </Button>
                        }
                      />
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
