import { ClipboardList } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { TimelineList } from '@/components/students/timeline-list'
import { createClient } from '@/lib/supabase/server'

export async function StudentTimeline({ studentId }: { studentId: string }) {
  const supabase = await createClient()

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
  const actorMap: Record<string, string> = {}
  for (const a of actors ?? []) actorMap[a.id] = a.display_name || a.full_name

  return <TimelineList activities={activities} actorMap={actorMap} />
}
