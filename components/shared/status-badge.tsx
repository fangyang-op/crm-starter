import { cn } from '@/lib/utils'
import { STUDENT_STATUS_CONFIG, type StudentStatus } from '@/lib/constants/student-status'

type StatusBadgeProps = {
  status: StudentStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const cfg = STUDENT_STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        cfg.badgeClass,
        className,
      )}
    >
      {cfg.label}
    </span>
  )
}
