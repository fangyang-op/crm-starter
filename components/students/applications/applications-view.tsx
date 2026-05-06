'use client'

import { useMemo, useState } from 'react'

import { CalendarClock, KeyRound, Layers, Table as TableIcon } from 'lucide-react'

import { ApplicationDetailSheet } from '@/components/students/applications/application-detail-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_VALUES,
  type ApplicationStatus,
} from '@/lib/constants/application-status'
import { COUNTRY_LABELS } from '@/lib/constants/school'

export type CommissionRow = {
  id: string
  expected_amount: number | null
  actual_amount: number | null
  currency: string
  status: string
  invoiced_at: string | null
  received_at: string | null
  notes: string | null
}

export type ApplicationRow = {
  id: string
  school_id: string
  school_name: string
  school_country: string
  school_is_partner: boolean
  school_commission_rate: number | null
  program_label: string
  status: ApplicationStatus
  application_round: string | null
  deadline: string | null
  submitted_at: string | null
  decision_at: string | null
  decision_notes: string | null
  portal_url: string | null
  portal_username: string | null
  has_portal_password: boolean
  portal_notes: string | null
  application_fee: number | null
  application_fee_paid: boolean
  notes: string | null
  tuition_amount: number | null
  tuition_currency: string
  commission: CommissionRow | null
}

type Props = {
  studentId: string
  applications: ApplicationRow[]
  canEdit: boolean
  isManager: boolean
}

export function ApplicationsView({ studentId, applications, canEdit, isManager }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(
    () => applications.find((a) => a.id === activeId) ?? null,
    [applications, activeId],
  )

  return (
    <div className="space-y-3">
      <Tabs defaultValue="board">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="board">
              <Layers size={14} className="mr-1.5" />
              看板
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon size={14} className="mr-1.5" />
              列表
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">共 {applications.length} 筆申請</p>
        </div>

        <TabsContent value="board" className="mt-3">
          <BoardView applications={applications} onOpen={setActiveId} />
        </TabsContent>

        <TabsContent value="table" className="mt-3">
          <TableView applications={applications} onOpen={setActiveId} />
        </TabsContent>
      </Tabs>

      <ApplicationDetailSheet
        studentId={studentId}
        application={active}
        canEdit={canEdit}
        isManager={isManager}
        open={Boolean(active)}
        onOpenChange={(o) => {
          if (!o) setActiveId(null)
        }}
      />
    </div>
  )
}

function BoardView({
  applications,
  onOpen,
}: {
  applications: ApplicationRow[]
  onOpen: (id: string) => void
}) {
  const grouped = useMemo(() => {
    const m = new Map<ApplicationStatus, ApplicationRow[]>()
    for (const s of APPLICATION_STATUS_VALUES) m.set(s, [])
    for (const a of applications) {
      const arr = m.get(a.status) ?? []
      arr.push(a)
      m.set(a.status, arr)
    }
    return m
  }, [applications])

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {APPLICATION_STATUS_VALUES.map((status) => {
        const cfg = APPLICATION_STATUS_CONFIG[status]
        const items = grouped.get(status) ?? []
        if (items.length === 0) return null
        return (
          <div key={status} className="rounded-md border bg-muted/30 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="outline" className={cn('border', cfg.badgeClass)}>
                {cfg.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((a) => (
                <BoardCard key={a.id} app={a} onOpen={() => onOpen(a.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoardCard({ app, onOpen }: { app: ApplicationRow; onOpen: () => void }) {
  const overdue = isOverdue(app.deadline) && !isDecisionStatus(app.status)
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer transition-shadow hover:shadow-md"
    >
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{app.school_name}</p>
            <p className="truncate text-xs text-muted-foreground">{app.program_label}</p>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {COUNTRY_LABELS[app.school_country as keyof typeof COUNTRY_LABELS] ??
              app.school_country}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {app.deadline ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                overdue ? 'bg-rose-50 text-rose-700' : 'bg-muted text-muted-foreground',
              )}
            >
              <CalendarClock size={11} />
              {app.deadline}
            </span>
          ) : null}
          {app.application_round ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {app.application_round}
            </span>
          ) : null}
          {app.has_portal_password ? (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              <KeyRound size={11} />
              帳密
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function TableView({
  applications,
  onOpen,
}: {
  applications: ApplicationRow[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>學校 / 科系</TableHead>
            <TableHead className="w-[100px]">狀態</TableHead>
            <TableHead className="w-[120px]">申請輪</TableHead>
            <TableHead className="w-[130px]">截止</TableHead>
            <TableHead className="w-[90px]">Portal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((a) => {
            const overdue = isOverdue(a.deadline) && !isDecisionStatus(a.status)
            const cfg = APPLICATION_STATUS_CONFIG[a.status]
            return (
              <TableRow
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(a.id)
                  }
                }}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="font-medium">{a.school_name}</div>
                  <div className="text-xs text-muted-foreground">{a.program_label}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('border', cfg.badgeClass)}>
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{a.application_round ?? '—'}</TableCell>
                <TableCell className={cn('text-sm tabular-nums', overdue && 'text-rose-700')}>
                  {a.deadline ?? '—'}
                </TableCell>
                <TableCell>
                  {a.has_portal_password ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(a.id)
                      }}
                    >
                      <KeyRound size={12} className="mr-1" />
                      已設
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  // Compare as YYYY-MM-DD strings (lexicographic = chronological at this granularity).
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  return deadline < today
}

function isDecisionStatus(s: ApplicationStatus): boolean {
  return (
    s === 'admitted' ||
    s === 'rejected' ||
    s === 'waitlisted' ||
    s === 'declined_by_us' ||
    s === 'enrolled'
  )
}
