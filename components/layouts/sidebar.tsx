'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  BarChart3,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Settings,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/constants/roles'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '儀表板', icon: LayoutDashboard },
  { href: '/students', label: '學生', icon: Users },
  { href: '/schools', label: '學校', icon: GraduationCap },
  { href: '/applications', label: '申請', icon: FileCheck },
  {
    href: '/workload',
    label: 'Workload',
    icon: BarChart3,
    roles: ['manager_frontend', 'manager_backend', 'admin'],
  },
  {
    href: '/reports',
    label: '報表',
    icon: LineChart,
    roles: ['manager_frontend', 'manager_backend', 'admin'],
  },
  { href: '/settings', label: '設定', icon: Settings, roles: ['admin'] },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/" className="text-base font-semibold">
          留學代辦 CRM
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
