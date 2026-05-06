import {
  ArrowRight,
  ClipboardList,
  Coins,
  DollarSign,
  Eye,
  FileEdit,
  GitFork,
  GraduationCap,
  Handshake,
  KeyRound,
  Lock,
  type LucideIcon,
  Send,
  Trash2,
  UserCircle,
  UserPlus,
} from 'lucide-react'

import {
  APPLICATION_STATUS_CONFIG,
  type ApplicationStatus,
} from '@/lib/constants/application-status'
import { COMMISSION_STATUS_CONFIG, type CommissionStatus } from '@/lib/constants/commission'
import { STUDENT_STATUS_CONFIG, type StudentStatus } from '@/lib/constants/student-status'
import type { Database } from '@/types/database'

type ActivityRow = Database['public']['Tables']['activity_log']['Row']

// Categories drive the filter chips in the timeline UI. Keep this list short
// and product-meaningful — these are user-visible filter labels.
export const TIMELINE_CATEGORIES = {
  basic: '基本資料',
  deal: '成交',
  schools: '選校',
  documents: '文件',
  scores: '成績',
  applications: '申請',
  credentials: '帳密',
  commission: '佣金',
  other: '其他',
} as const

export type TimelineCategory = keyof typeof TIMELINE_CATEGORIES

export type ActivityDisplay = {
  icon: LucideIcon
  iconClass: string
  description: string
  category: TimelineCategory
}

function studentStatusLabel(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const cfg = STUDENT_STATUS_CONFIG[s as StudentStatus]
  return cfg ? cfg.label : s
}

function applicationStatusLabel(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const cfg = APPLICATION_STATUS_CONFIG[s as ApplicationStatus]
  return cfg ? cfg.label : s
}

function commissionStatusLabel(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const cfg = COMMISSION_STATUS_CONFIG[s as CommissionStatus]
  return cfg ? cfg.label : s
}

export function formatActivity(activity: ActivityRow, actorName?: string): ActivityDisplay {
  const actor = actorName ?? '系統'
  const payload = (activity.payload ?? {}) as Record<string, unknown>

  switch (activity.action) {
    // ── 基本資料 ──────────────────────────────────────────────────
    case 'student_created':
      return {
        icon: UserCircle,
        iconClass: 'text-emerald-600',
        description: `${actor} 建立了這位學生`,
        category: 'basic',
      }
    case 'student_updated':
      return {
        icon: FileEdit,
        iconClass: 'text-slate-600',
        description: `${actor} 更新了學生資料`,
        category: 'basic',
      }
    case 'student_deleted':
      return {
        icon: Trash2,
        iconClass: 'text-destructive',
        description: `${actor} 刪除了這位學生`,
        category: 'basic',
      }
    case 'status_changed': {
      const from = studentStatusLabel(payload.from)
      const to = studentStatusLabel(payload.to)
      return {
        icon: ArrowRight,
        iconClass: 'text-blue-600',
        description:
          from && to
            ? `${actor} 將狀態從「${from}」改為「${to}」`
            : (activity.description ?? `${actor} 變更了狀態`),
        category: 'basic',
      }
    }
    case 'consultant_assigned': {
      const role = typeof payload.role === 'string' ? payload.role : null
      const roleLabel = role === 'frontend' ? '前端顧問' : role === 'backend' ? '後端顧問' : '顧問'
      const isInitial = payload.from === null
      return {
        icon: UserPlus,
        iconClass: 'text-violet-600',
        description: isInitial ? `${actor} 指派了${roleLabel}` : `${actor} 變更了${roleLabel}`,
        category: 'basic',
      }
    }

    // ── 成交 ──────────────────────────────────────────────────────
    case 'deal_created':
      return {
        icon: Handshake,
        iconClass: 'text-amber-600',
        description: activity.description ?? `${actor} 建立了成交`,
        category: 'deal',
      }
    case 'deal_updated':
      return {
        icon: FileEdit,
        iconClass: 'text-amber-700',
        description: activity.description ?? `${actor} 編輯了成交`,
        category: 'deal',
      }

    // ── 選校 ──────────────────────────────────────────────────────
    case 'school_list_created': {
      const version = payload.version
      return {
        icon: GitFork,
        iconClass: 'text-indigo-600',
        description:
          typeof version === 'number'
            ? `${actor} 建立了選校表 V${version}`
            : (activity.description ?? `${actor} 建立了選校表`),
        category: 'schools',
      }
    }
    case 'school_list_locked': {
      const version = payload.version
      return {
        icon: Lock,
        iconClass: 'text-cyan-600',
        description:
          typeof version === 'number'
            ? `${actor} 鎖定了選校表 V${version}`
            : (activity.description ?? `${actor} 鎖定選校表`),
        category: 'schools',
      }
    }
    case 'applications_expanded': {
      const created = typeof payload.created === 'number' ? payload.created : null
      const skipped = typeof payload.skipped === 'number' ? payload.skipped : null
      return {
        icon: Send,
        iconClass: 'text-indigo-600',
        description:
          created !== null
            ? `${actor} 將選校表展開為 ${created} 筆申請${skipped ? ` (略過 ${skipped} 筆已存在)` : ''}`
            : `${actor} 展開選校表為申請項`,
        category: 'schools',
      }
    }

    // ── 文件 ──────────────────────────────────────────────────────
    case 'document_revised':
      return {
        icon: FileEdit,
        iconClass: 'text-purple-600',
        description: activity.description ?? `${actor} 修改了文件`,
        category: 'documents',
      }
    case 'document_forked':
      return {
        icon: GitFork,
        iconClass: 'text-fuchsia-600',
        description: activity.description ?? `${actor} Fork 了文件`,
        category: 'documents',
      }

    // ── 成績 ──────────────────────────────────────────────────────
    case 'score_added': {
      const t = typeof payload.score_type === 'string' ? payload.score_type.toUpperCase() : null
      return {
        icon: GraduationCap,
        iconClass: 'text-teal-600',
        description: t ? `${actor} 新增了 ${t} 成績` : `${actor} 新增了成績`,
        category: 'scores',
      }
    }
    case 'score_updated': {
      const t = typeof payload.score_type === 'string' ? payload.score_type.toUpperCase() : null
      return {
        icon: FileEdit,
        iconClass: 'text-teal-600',
        description: t ? `${actor} 更新了 ${t} 成績` : `${actor} 更新了成績`,
        category: 'scores',
      }
    }
    case 'score_deleted':
      return {
        icon: Trash2,
        iconClass: 'text-rose-600',
        description: `${actor} 刪除了一筆成績`,
        category: 'scores',
      }

    // ── 申請 ──────────────────────────────────────────────────────
    case 'application_submitted':
      return {
        icon: Send,
        iconClass: 'text-indigo-600',
        description: activity.description ?? `${actor} 送出申請`,
        category: 'applications',
      }
    case 'application_status_changed': {
      const from = applicationStatusLabel(payload.from)
      const to = applicationStatusLabel(payload.to)
      return {
        icon: ArrowRight,
        iconClass: 'text-blue-600',
        description:
          from && to ? `${actor} 將申請狀態從「${from}」改為「${to}」` : `${actor} 變更了申請狀態`,
        category: 'applications',
      }
    }

    // ── 帳密 ──────────────────────────────────────────────────────
    case 'application_portal_password_changed': {
      const cleared = payload.cleared === true
      return {
        icon: KeyRound,
        iconClass: 'text-orange-600',
        description: cleared ? `${actor} 清除了 Portal 密碼` : `${actor} 變更了 Portal 密碼`,
        category: 'credentials',
      }
    }
    case 'portal_password_revealed':
      return {
        icon: Eye,
        iconClass: 'text-orange-600',
        description: `${actor} 查看了 Portal 密碼`,
        category: 'credentials',
      }

    // ── 佣金 ──────────────────────────────────────────────────────
    case 'commission_created': {
      const expected = typeof payload.expected_amount === 'number' ? payload.expected_amount : null
      return {
        icon: Coins,
        iconClass: 'text-emerald-700',
        description:
          expected !== null
            ? `系統建立佣金紀錄,預期金額 ${expected.toLocaleString('en-US')}`
            : '系統建立佣金紀錄',
        category: 'commission',
      }
    }
    case 'commission_recomputed': {
      const expected = typeof payload.expected_amount === 'number' ? payload.expected_amount : null
      return {
        icon: Coins,
        iconClass: 'text-emerald-700',
        description:
          expected !== null
            ? `${actor} 重算佣金,預期金額 ${expected.toLocaleString('en-US')}`
            : `${actor} 重算佣金`,
        category: 'commission',
      }
    }
    case 'commission_updated': {
      const status = commissionStatusLabel(payload.status)
      const actual = typeof payload.actual_amount === 'number' ? payload.actual_amount : null
      const parts = [`${actor} 更新了佣金`]
      if (status) parts.push(`狀態:${status}`)
      if (actual !== null) parts.push(`實收 ${actual.toLocaleString('en-US')}`)
      return {
        icon: DollarSign,
        iconClass: 'text-emerald-700',
        description: parts.join(' · '),
        category: 'commission',
      }
    }
    case 'commission_review_needed':
      return {
        icon: DollarSign,
        iconClass: 'text-amber-600',
        description: `申請已退出「確定入學」,請主管確認既有佣金紀錄是否需要調整`,
        category: 'commission',
      }
    case 'commission_received':
      return {
        icon: DollarSign,
        iconClass: 'text-green-700',
        description: activity.description ?? '佣金已入帳',
        category: 'commission',
      }

    // ── Default ──────────────────────────────────────────────────
    default:
      return {
        icon: ClipboardList,
        iconClass: 'text-muted-foreground',
        description: activity.description ?? `${actor} ${activity.action}`,
        category: 'other',
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
