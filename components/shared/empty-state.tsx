import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-md border border-dashed p-12 text-center', className)}>
      {Icon ? (
        <div className="flex justify-center">
          <Icon className="text-muted-foreground" size={32} />
        </div>
      ) : null}
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
