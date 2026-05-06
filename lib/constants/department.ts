export const DEPARTMENT_VALUES = ['frontend', 'backend', 'operations'] as const

export type Department = (typeof DEPARTMENT_VALUES)[number]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  frontend: '前端',
  backend: '後端',
  operations: '營運',
}
