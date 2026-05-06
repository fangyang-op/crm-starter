import type { Database } from '@/types/database'

export type UserRole = Database['public']['Enums']['user_role']

export const ROLE_LABELS: Record<UserRole, string> = {
  consultant: '顧問',
  manager_frontend: '前端主管',
  manager_backend: '後端主管',
  admin: '管理員',
}

export const MANAGER_ROLES: UserRole[] = ['manager_frontend', 'manager_backend', 'admin']

export function isManagerOrAdmin(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role)
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin'
}
