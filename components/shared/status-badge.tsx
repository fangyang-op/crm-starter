import { cn } from '@/lib/utils'
import { statusBadgeClass } from '@/lib/constants/student-status'

type StatusBadgeProps = {
  /** Visible Chinese label, e.g. 「新名單」. Comes from student_statuses.label_zh. */
  label: string
  /** Color preset key (e.g. 'slate', 'emerald'). Comes from student_statuses.color_key. */
  colorKey: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ label, colorKey, size = 'md', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        statusBadgeClass(colorKey),
        className,
      )}
    >
      {label}
    </span>
  )
}
