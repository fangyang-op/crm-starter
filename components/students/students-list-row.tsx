'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { StatusBadge } from '@/components/shared/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import type { StudentStatus } from '@/lib/constants/student-status'

export type StudentRowData = {
  id: string
  full_name: string
  english_name: string | null
  status: StudentStatus
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
        {/* Keep an inner Link so right-click → open in new tab still works.
            stopPropagation prevents firing router.push twice. */}
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
        <StatusBadge status={student.status} size="sm" />
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
