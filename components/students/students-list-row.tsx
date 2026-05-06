'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { StatusBadge } from '@/components/shared/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'

export type StudentRowData = {
  id: string
  full_name: string
  english_name: string | null
  /** Status display fields, denormalized server-side from student_statuses. */
  status_label: string
  status_color_key: string | null
  frontend_consultant_name: string | null
  backend_consultant_name: string | null
  target: string
  created_at: string
}

export function StudentsListRow({ student }: { student: StudentRowData }) {
  const router = useRouter()
  return (
    <TableRow
      role="link"
      tabIndex={0}
      className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
      onClick={() => router.push(`/students/${student.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/students/${student.id}`)
        }
      }}
    >
      <TableCell className="font-medium">
        <Link
          href={`/students/${student.id}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {student.full_name}
          {student.english_name ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {student.english_name}
            </span>
          ) : null}
        </Link>
      </TableCell>
      <TableCell>
        <StatusBadge label={student.status_label} colorKey={student.status_color_key} size="sm" />
      </TableCell>
      <TableCell className="text-sm">{student.frontend_consultant_name ?? '—'}</TableCell>
      <TableCell className="text-sm">{student.backend_consultant_name ?? '—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{student.target}</TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {new Date(student.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}
      </TableCell>
    </TableRow>
  )
}
