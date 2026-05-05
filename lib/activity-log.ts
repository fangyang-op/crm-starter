import {
  ArrowRight,
  ClipboardList,
  DollarSign,
  Eye,
  FileEdit,
  GitFork,
  Handshake,
  Lock,
  type LucideIcon,
  Send,
  UserCircle,
  UserPlus,
} from 'lucide-react'

import { STUDENT_STATUS_CONFIG, type StudentStatus } from '@/lib/constants/student-status'
import type { Database } from '@/types/database'

type ActivityRow = Database['public']['Tables']['activity_log']['Row']

export type ActivityDisplay = {
  icon: LucideIcon
  iconClass: string
  description: string
}

function statusLabel(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const cfg = STUDENT_STATUS_CONFIG[s as StudentStatus]
  return cfg ? cfg.label : s
}

export function formatActivity(activity: ActivityRow, actorName?: string): ActivityDisplay {
  const actor = actorName ?? '系統'
  const payload = (activity.payload ?? {}) as Record<string, unknown>

  switch (activity.action) {
    case 'student_created':
      return {
        icon: UserCircle,
        iconClass: 'text-emerald-600',
        description: `${actor} 建立了這位學生`,
      }
    case 'student_updated':
      return {
        icon: FileEdit,
        iconClass: 'text-slate-600',
        description: `${actor} 更新了學生資料`,
      }
    case 'status_changed': {
      const from = statusLabel(payload.from)
      const to = statusLabel(payload.to)
      return {
        icon: ArrowRight,
        iconClass: 'text-blue-600',
        description:
          from && to
            ? `${actor} 將狀態從「${from}」改為「${to}」`
            : (activity.description ?? `${actor} 變更了狀態`),
      }
    }
    case 'consultant_assigned':
      return {
        icon: UserPlus,
        iconClass: 'text-violet-600',
        description: activity.description ?? `${actor} 指派了顧問`,
      }
    case 'deal_created':
      return {
        icon: Handshake,
        iconClass: 'text-amber-600',
        description: activity.description ?? `${actor} 建立了成交`,
      }
    case 'school_list_locked':
      return {
        icon: Lock,
        iconClass: 'text-cyan-600',
        description: activity.description ?? `${actor} 鎖定選校表`,
      }
    case 'application_submitted':
      return {
        icon: Send,
        iconClass: 'text-indigo-600',
        description: activity.description ?? `${actor} 送出申請`,
      }
    case 'document_revised':
      return {
        icon: FileEdit,
        iconClass: 'text-purple-600',
        description: activity.description ?? `${actor} 修改文件`,
      }
    case 'document_forked':
      return {
        icon: GitFork,
        iconClass: 'text-fuchsia-600',
        description: activity.description ?? `${actor} Fork 文件`,
      }
    case 'portal_password_revealed':
      return {
        icon: Eye,
        iconClass: 'text-orange-600',
        description: activity.description ?? `${actor} 查看 portal 帳密`,
      }
    case 'commission_received':
      return {
        icon: DollarSign,
        iconClass: 'text-green-600',
        description: activity.description ?? `回傭已入帳`,
      }
    default:
      return {
        icon: ClipboardList,
        iconClass: 'text-muted-foreground',
        description: activity.description ?? `${actor}${activity.action}`,
      }
  }
}

export function formatActivityTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
