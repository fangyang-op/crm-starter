'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatActivity,
  formatActivityTime,
  TIMELINE_CATEGORIES,
  type TimelineCategory,
} from '@/lib/activity-log'
import type { Database } from '@/types/database'

type ActivityRow = Database['public']['Tables']['activity_log']['Row']

type Props = {
  activities: ActivityRow[]
  actorMap: Record<string, string>
}

export function TimelineList({ activities, actorMap }: Props) {
  const enriched = useMemo(
    () =>
      activities.map((activity) => {
        const actorName = activity.actor_id ? actorMap[activity.actor_id] : undefined
        return { activity, display: formatActivity(activity, actorName) }
      }),
    [activities, actorMap],
  )

  // Only render filter chips for categories that actually appear in this
  // student's history — keeps the chip row tidy.
  const presentCategories = useMemo(() => {
    const set = new Set<TimelineCategory>()
    for (const e of enriched) set.add(e.display.category)
    return (Object.keys(TIMELINE_CATEGORIES) as TimelineCategory[]).filter((c) => set.has(c))
  }, [enriched])

  // null = show all; non-null = show only that category. Single-select
  // because dropping into multi-select adds clutter for what's usually a
  // narrow filter ("just show me 文件 events").
  const [selected, setSelected] = useState<TimelineCategory | null>(null)

  const filtered = useMemo(
    () => (selected === null ? enriched : enriched.filter((e) => e.display.category === selected)),
    [enriched, selected],
  )

  return (
    <div className="space-y-4">
      {presentCategories.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant={selected === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelected(null)}
          >
            全部 ({enriched.length})
          </Button>
          {presentCategories.map((cat) => {
            const count = enriched.filter((e) => e.display.category === cat).length
            return (
              <Button
                key={cat}
                type="button"
                variant={selected === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelected(cat)}
              >
                {TIMELINE_CATEGORIES[cat]} ({count})
              </Button>
            )
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          這個分類目前沒有紀錄。
        </p>
      ) : (
        <ol className="space-y-3">
          {filtered.map(({ activity, display }) => {
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
      )}
    </div>
  )
}
