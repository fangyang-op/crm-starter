import { ClipboardList } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import { formatActivity, formatActivityTime } from '@/lib/activity-log'
import { createClient } from '@/lib/supabase/server'

export async function StudentTimeline({ studentId }: { studentId: string }) {
  const supabase = createClient()

  const { data: activities, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        載入時間軸失敗:{error.message}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="尚無活動紀錄"
        description="建立學生、狀態變更、文件編輯、成交等重要事件都會出現在這裡"
      />
    )
  }

  const actorIds = Array.from(
    new Set(activities.map((a) => a.actor_id).filter((v): v is string => Boolean(v))),
  )
  const { data: actors } =
    actorIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, display_name').in('id', actorIds)
      : { data: [] as Array<{ id: string; full_name: string; display_name: string | null }> }
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.display_name || a.full_name]))

  return (
    <ol className="space-y-3">
      {activities.map((activity) => {
        const actorName = activity.actor_id ? actorMap.get(activity.actor_id) : undefined
        const display = formatActivity(activity, actorName)
        const Icon = display.icon
        return (
          <li key={activity.id} className="flex gap-3 rounded-md border bg-card p-4 text-sm">
            <div className={cn('mt-0.5 shrink-0', display.iconClass)}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p>{display.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatActivityTime(activity.created_at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
