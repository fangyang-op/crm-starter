'use client'

import Link from 'next/link'

import { ChevronDown, KeyRound, LogOut } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS, type UserRole } from '@/lib/constants/roles'

type TopbarProps = {
  fullName: string
  displayName: string | null
  email: string
  role: UserRole
}

/** 中文姓名取第一個字(「馮若陽」→「馮」),英文姓名取第一個字母大寫
 *  (「Marcus」→「M」)。空字串 fallback「?」。
 *
 *  Array.from 確保多字節字元不會被切半;中文字無大寫形態,toUpperCase()
 *  會把英文轉大寫、漢字保持原樣,所以一行就涵蓋兩種情境。*/
function firstChar(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = Array.from(trimmed)[0]
  if (!first) return '?'
  return first.toUpperCase()
}

export function Topbar({ fullName, displayName, email, role }: TopbarProps) {
  const shown = displayName || fullName
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
            {/* 圓形品牌色頭像,姓名首字白字置中。font-size 14px / weight 600
                覆蓋 AvatarFallback 預設的 text-sm。*/}
            <Avatar className="h-7 w-7">
              <AvatarFallback
                className="font-semibold text-white"
                style={{ backgroundColor: '#C7315C', fontSize: '14px' }}
              >
                {firstChar(displayName || fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight">{shown}</div>
              <div className="text-xs leading-tight text-muted-foreground">{ROLE_LABELS[role]}</div>
            </div>
            <ChevronDown size={16} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-sm font-medium">{shown}</span>
            <span className="text-xs font-normal text-muted-foreground">{email}</span>
            <Badge variant="secondary" className="mt-1 w-fit">
              {ROLE_LABELS[role]}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account/security" className="flex items-center gap-2">
              <KeyRound size={16} />
              <span>修改密碼</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action="/logout" method="post" className="w-full">
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut size={16} />
                <span>登出</span>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
