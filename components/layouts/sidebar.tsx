'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  BarChart,
  BarChart3,
  ClipboardCheck,
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
  /** Optional dynamic badge key — see `badges` prop on Sidebar. */
  badgeKey?: 'uat_pending'
  /** 子項目視覺縮排;只在展開模式生效(收合模式仍是 icon-only)。 */
  indent?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '儀表板', icon: LayoutDashboard },
  { href: '/students', label: '學生專案管理', icon: Users },
  { href: '/schools', label: '常用院校檢索', icon: GraduationCap },
  { href: '/applications', label: '申請進度看板', icon: FileCheck },
  {
    href: '/workload',
    label: '後端量能管理',
    icon: BarChart3,
    roles: ['manager_frontend', 'manager_backend', 'admin'],
  },
  {
    href: '/reports',
    label: '營收績效管理',
    icon: LineChart,
    roles: ['manager_frontend', 'manager_backend', 'admin'],
  },
  // uat-portal §1: 封測期間限定入口 — 顯示給所有角色,未填項數做為 badge。
  // 後續若改為「問題回報」常設專區,可保留此 nav 並換 badge 邏輯。
  { href: '/uat', label: '內部封測回報', icon: ClipboardCheck, badgeKey: 'uat_pending' },
  // uat-portal §5: Admin 總覽 — 縮排在「測試回報」下方,僅 admin 可見。
  { href: '/uat/admin', label: 'Admin 總覽', icon: BarChart, roles: ['admin'], indent: true },
  // 權限矩陣 §3.1:設定為 admin-only,故側欄入口只對 admin 顯示(與
  // settings/layout.tsx 的路由閘門一致)。
  {
    href: '/settings',
    label: '設定',
    icon: Settings,
    roles: ['admin'],
  },
]

const STORAGE_KEY = 'sidebar-collapsed'
const WIDTH_EXPANDED = 240
const WIDTH_COLLAPSED = 64

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export type SidebarBadges = {
  /** uat-portal §1/§6: 未填寫的測試項目數,= 0 時 badge 隱藏。 */
  uat_pending?: number
}

export function Sidebar({ role, badges }: { role: UserRole; badges?: SidebarBadges }) {
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
          'flex h-14 items-center justify-between gap-2 border-b',
          collapsed ? 'px-2' : 'px-4',
        )}
      >
        {/* 收合(64px 寬)只留切換鈕;展開時 logo + 雙行標題並排,標題用品牌
            色 #C7315C。Link 不用 flex-1,讓它佔自然寬度 + 容器 gap-2 與右側
            收合鈕之間留出空隙。*/}
        {collapsed ? null : (
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 truncate leading-tight"
            title="放洋全端 CRM 平台"
          >
            <Image
              src="/logo.svg"
              width={28}
              height={28}
              alt="放洋 Logo"
              className="shrink-0"
              priority
            />
            <div className="flex min-w-0 flex-col">
              {/* 240px sidebar - 32px(px-4) - 28px(logo) - 16px(gaps) - 32px(button)
                  ≈ 132px 可用寬度。13px 字體在這個寬度下能完整顯示 11 字元
                  標題;若仍被截斷再降到 12px。*/}
              <span className="truncate font-bold" style={{ color: '#C7315C', fontSize: '13px' }}>
                放洋全端 CRM 平台
              </span>
              <span className="truncate text-[0.7rem] text-muted-foreground">顧問資訊整合中心</span>
            </div>
          </Link>
        )}
        {/* ml-auto 把按鈕釘到右側;當 Link 為 null(收合)時,單一子項會被
            justify-between 視為靠左,改用 mx-auto 維持置中。*/}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'mx-auto' : 'ml-auto',
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
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined
          const showBadge = typeof badgeCount === 'number' && badgeCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              // Native title for tooltip on collapsed icons; cheap + works
              // without pulling in a Radix Tooltip on every nav item.
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-md text-sm transition-colors',
                collapsed
                  ? 'h-10 justify-center px-2'
                  : item.indent
                    ? // 子項目:左側 padding 2.5rem 讓 icon 對齊父項標籤起點。
                      'py-2 pl-10 pr-3'
                    : 'px-3 py-2',
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
              {showBadge ? (
                collapsed ? (
                  <span
                    aria-label={`${badgeCount} 個未完成`}
                    className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
                  >
                    {badgeCount}
                  </span>
                ) : (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                    {badgeCount}
                  </span>
                )
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
