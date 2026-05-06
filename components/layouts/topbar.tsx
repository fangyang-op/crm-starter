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

function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // For Chinese names, take last 2 chars; for English, take first letter of first 2 words.
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return trimmed.slice(-2)
}

export function Topbar({ fullName, displayName, email, role }: TopbarProps) {
  const shown = displayName || fullName
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials(fullName)}</AvatarFallback>
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
