'use client'

import { useState, useTransition } from 'react'

import { Download, Eye, FileWarning } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getUatScreenshotSignedUrl } from '../actions'
import { exportUatCsv } from './actions'

export type AdminPersonRow = {
  user_id: string
  name: string
  role: string
  total: number
  filled: number
  pass: number
  fail: number
  remaining: number
}

export type AdminFailReporter = {
  user_id: string
  name: string
  note: string
  screenshot_path: string | null
}

export type AdminFailRow = {
  item_id: string
  item_code: string
  step_description: string
  fail_count: number
  reporters: AdminFailReporter[]
}

type AdminStats = {
  testers: number
  chapterCompletionRate: number
  totalPass: number
  totalFail: number
}

export function AdminClient({
  stats,
  people,
  fails,
}: {
  stats: AdminStats
  people: AdminPersonRow[]
  fails: AdminFailRow[]
}) {
  const [pending, startTransition] = useTransition()

  const onExport = () => {
    startTransition(async () => {
      const res = await exportUatCsv()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // Browser-side blob download — server action 已經產 CSV 字串,
      // 這裡只是把它變成檔案。
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV 已匯出')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onExport} disabled={pending} variant="outline" size="sm">
          <Download size={14} className="mr-1" />
          {pending ? '匯出中…' : '匯出 CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="測試人員" value={`${stats.testers} 人`} />
        <StatCard label="章節完成率" value={`${stats.chapterCompletionRate}%`} />
        <StatCard label="通過項目" value={String(stats.totalPass)} tone="success" />
        <StatCard label="失敗項目" value={String(stats.totalFail)} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">人員進度總表</CardTitle>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">尚無使用者資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">姓名</th>
                    <th className="px-2 py-2 text-left">角色</th>
                    <th className="px-2 py-2 text-left">進度</th>
                    <th className="px-2 py-2 text-right">通過</th>
                    <th className="px-2 py-2 text-right">失敗</th>
                    <th className="px-2 py-2 text-right">未填</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {people.map((p) => {
                    const pct = p.total === 0 ? 0 : Math.round((p.filled / p.total) * 100)
                    return (
                      <tr key={p.user_id}>
                        <td className="px-2 py-2 font-medium">{p.name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{p.role}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {p.filled}/{p.total}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right text-green-700">{p.pass}</td>
                        <td className="px-2 py-2 text-right text-red-600">{p.fail}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">
                          {p.remaining}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning size={16} className="text-red-500" />
            失敗項目清單
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fails.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              目前沒有任何失敗回報 🎉
            </p>
          ) : (
            <div className="space-y-3">
              {fails.map((f) => (
                <FailRow key={f.item_id} row={f} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FailRow({ row }: { row: AdminFailRow }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {row.item_code}
            </span>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {row.fail_count} 人失敗
            </span>
          </div>
          <p className="mt-1 truncate text-sm">{row.step_description}</p>
        </div>
        <span className="mt-1 shrink-0 text-xs text-muted-foreground">
          {open ? '收合' : '展開'}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t bg-muted/20 px-3 py-2">
          {row.reporters.map((r) => (
            <div key={r.user_id} className="flex items-start gap-3 text-sm">
              <span className="min-w-20 shrink-0 font-medium">{r.name}</span>
              <span className="flex-1 whitespace-pre-wrap text-muted-foreground">
                {r.note || '(未填備註)'}
              </span>
              {r.screenshot_path ? <ScreenshotLink path={r.screenshot_path} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ScreenshotLink({ path }: { path: string }) {
  const [pending, startTransition] = useTransition()
  const onClick = () => {
    startTransition(async () => {
      const res = await getUatScreenshotSignedUrl(path)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }
  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick} disabled={pending}>
      <Eye size={14} className="mr-1" />
      截圖
    </Button>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'success'
            ? 'mt-1 text-2xl font-semibold text-green-700'
            : tone === 'danger'
              ? 'mt-1 text-2xl font-semibold text-red-600'
              : 'mt-1 text-2xl font-semibold'
        }
      >
        {value}
      </p>
    </div>
  )
}
