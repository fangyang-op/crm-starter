import type { StudentStatus } from '@/lib/constants/student-status'

/**
 * Legal status transitions per docs/08 §1.2.
 *
 * Terminal states (`enrolled`, `terminated`, `disqualified`) have no transitions.
 * `paused` can resume to any non-terminal active stage.
 * Any non-terminal state can move to `paused` and most can move to a terminal state.
 */
export const ALLOWED_TRANSITIONS: Record<StudentStatus, readonly StudentStatus[]> = {
  // 招生階段
  new_lead: ['contacted', 'disqualified', 'paused'],
  contacted: ['consulting', 'disqualified', 'paused'],
  consulting: ['qualified', 'contacted', 'disqualified', 'paused'],
  qualified: ['closed_won', 'consulting', 'disqualified', 'paused'],

  // 成交分水嶺
  closed_won: ['onboarding', 'terminated', 'paused'],

  // 申請階段
  onboarding: ['school_selection', 'terminated', 'paused'],
  school_selection: ['document_prep', 'onboarding', 'terminated', 'paused'],
  document_prep: ['submitting', 'school_selection', 'terminated', 'paused'],
  submitting: ['awaiting_decision', 'document_prep', 'terminated', 'paused'],
  awaiting_decision: ['decision_making', 'terminated', 'paused'],
  decision_making: ['pre_departure', 'awaiting_decision', 'terminated', 'paused'],
  pre_departure: ['enrolled', 'terminated', 'paused'],

  // 終止狀態(無 transition)
  enrolled: [],
  terminated: [],
  disqualified: [],

  // 暫緩(可恢復至任意非終止狀態)
  paused: [
    'new_lead',
    'contacted',
    'consulting',
    'qualified',
    'closed_won',
    'onboarding',
    'school_selection',
    'document_prep',
    'submitting',
    'awaiting_decision',
    'decision_making',
    'pre_departure',
  ],
}

export function isLegalTransition(from: StudentStatus, to: StudentStatus): boolean {
  if (from === to) return false
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}
