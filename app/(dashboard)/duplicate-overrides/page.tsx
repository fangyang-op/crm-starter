import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AlertTriangle, ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isManagerOrAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '重複名單覆蓋紀錄 — 放洋全端 CRM 平台' }

type ActivityRow = {
  id: string
  student_id: string
  actor_id: string | null
  payload: { duplicate_of_student_id?: string; phone?: string; reason?: string } | null
  created_at: string
}

export default async function DuplicateOverridesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me) redirect('/login')
  if (!isManagerOrAdmin((me as { role: UserRole }).role)) redirect('/')

  // duplicate-prevention §4 — list every duplicate_phone_override entry.
  // RLS already gates by manager-or-admin / student-consultant, but we
  // belt-and-braces with the page-level role check above so non-managers
  // who land here directly via URL get redirected to /.
  const { data: rowsRaw } = await supabase
    .from('activity_log')
    .select('id, student_id, actor_id, payload, created_at')
    .eq('action', 'duplicate_phone_override')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (rowsRaw ?? []) as unknown as ActivityRow[]

  // Resolve actor + student names in batched fetches.
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]))
  const studentIds = Array.from(
    new Set([
      ...rows.map((r) => r.student_id).filter(Boolean),
      ...rows.map((r) => r.payload?.duplicate_of_student_id).filter((v): v is string => Boolean(v)),
    ]),
  )
  const [{ data: profiles }, { data: students }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from('profiles').select('id, full_name, display_name').in('id', actorIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; full_name: string; display_name: string | null }>,
        }),
    studentIds.length > 0
      ? supabase.from('students').select('id, full_name').in('id', studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ])
  const actorMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.full_name]))
  const studentMap = new Map((students ?? []).map((s) => [s.id, s.full_name]))

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">重複名單覆蓋紀錄</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          顧問建檔時偵測到相同手機號碼,但仍選擇「確認為不同學生」繼續建立的紀錄。
          建議比對兩筆名單的詳細資料,確認是否需要合併或刪除其中一筆。
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
          目前沒有任何覆蓋紀錄。
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const dupId = r.payload?.duplicate_of_student_id
            const phone = r.payload?.phone
            const newName = studentMap.get(r.student_id) ?? '(已刪除)'
            const dupName = dupId ? (studentMap.get(dupId) ?? '(已刪除)') : null
            const actor = r.actor_id ? (actorMap.get(r.actor_id) ?? '—') : '—'
            const dt = new Date(r.created_at).toLocaleString('zh-TW', {
              timeZone: 'Asia/Taipei',
            })
            return (
              <Card key={r.id} className="border-amber-200">
                <CardHeader className="flex flex-row items-start gap-2 space-y-0 pb-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold text-amber-900">
                      {actor} 建立了與現有名單同號的新學生
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{dt}</p>
                  </div>
                  {phone ? <Badge variant="outline">電話 {phone}</Badge> : null}
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-2">
                  <DupSlot label="新建立的學生" name={newName} studentId={r.student_id} />
                  {dupId ? (
                    <DupSlot label="既有重複名單" name={dupName ?? '—'} studentId={dupId} />
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      payload 缺 duplicate_of_student_id — 舊紀錄或被刪除
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DupSlot({ label, name, studentId }: { label: string; name: string; studentId: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{name}</p>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href={`/students/${studentId}`} target="_blank" rel="noopener noreferrer">
          開啟學生
          <ExternalLink size={12} className="ml-1" />
        </Link>
      </Button>
    </div>
  )
}
