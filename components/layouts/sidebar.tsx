'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  BarChart3,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
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
  {
    href: '/settings',
    label: '設定',
    icon: Settings,
    roles: ['manager_frontend', 'manager_backend', 'admin'],
  },
]

const STORAGE_KEY = 'sidebar-collapsed'
const WIDTH_EXPANDED = 240
const WIDTH_COLLAPSED = 64

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))

  // Hydrate the persisted collapse state on mount. Render expanded by default
  // — there's a brief flash on first paint if the user previously collapsed,
  // but skipping the localStorage-flash dance keeps SSR deterministic.
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      // localStorage can throw in private mode / blocked storage — ignore.
    }
    setHydrated(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ditto
      }
      return next
    })
  }

  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED

  return (
    <aside
      className="relative z-10 flex shrink-0 flex-col bg-white"
      style={{
        width,
        // Spec §1.1: lift sidebar above main with a soft right shadow + a 1px
        // border line. Two layered shadows so the surface still reads as a
        // panel against the off-white #F9FAFC main background.
        boxShadow: '4px 0 16px rgba(0, 0, 0, 0.06), 1px 0 0 #E5E7EB',
        // Smooth animation only after first hydration, otherwise the initial
        // expanded → collapsed switch animates at page load.
        transition: hydrated ? 'width 220ms ease' : undefined,
      }}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? null : (
          <Link href="/" className="flex-1 truncate text-base font-semibold" title="留學代辦 CRM">
            留學代辦 CRM
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'mt-0',
          )}
          aria-label={collapsed ? '展開側邊欄' : '收合側邊欄'}
          title={collapsed ? '展開側邊欄' : '收合側邊欄'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-1.5' : 'p-3')}>
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              // Native title for tooltip on collapsed icons; cheap + works
              // without pulling in a Radix Tooltip on every nav item.
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-md text-sm transition-colors',
                collapsed ? 'h-10 justify-center px-2' : 'px-3 py-2',
                active
                  ? // Spec §1.3: active = brand bg @ 10% + brand text + 2px
                    // left bar. The bar is rendered as a ::before via an inset
                    // span so it sits inside the rounded corners.
                    'bg-primary/10 font-medium text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-primary"
                />
              ) : null}
              <Icon size={18} className="shrink-0" />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
