import Link from 'next/link'

import { ChevronRight, KeyRound, ListTree, Package, Tags, UserSquare } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '設定 — 放洋全端 CRM 平台' }

export default async function SettingsIndexPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const role = (profile?.role ?? 'consultant') as UserRole

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">系統與業務基礎資料管理</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/settings/referrers">
          <Card className="transition-colors hover:border-primary">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <UserSquare className="text-muted-foreground" size={20} />
                <CardTitle className="text-base">轉介人</CardTitle>
              </div>
              <ChevronRight className="text-muted-foreground" size={16} />
            </CardHeader>
            <CardContent>
              <CardDescription>
                外部介紹人/合作品牌名單,用於記錄學生來源與績效拆分。
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {isAdmin(role) ? (
          <Link href="/settings/lead-sources">
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListTree className="text-muted-foreground" size={20} />
                  <CardTitle className="text-base">名單來源</CardTitle>
                </div>
                <ChevronRight className="text-muted-foreground" size={16} />
              </CardHeader>
              <CardContent>
                <CardDescription>學生來源類型。Admin 可新增、改名、調順序、停用。</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {isAdmin(role) ? (
          <Link href="/settings/plans">
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="text-muted-foreground" size={20} />
                  <CardTitle className="text-base">服務方案</CardTitle>
                </div>
                <ChevronRight className="text-muted-foreground" size={16} />
              </CardHeader>
              <CardContent>
                <CardDescription>方案內容、價格、加購單價(僅 admin)。</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {isAdmin(role) ? (
          <Link href="/settings/users">
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="text-muted-foreground" size={20} />
                  <CardTitle className="text-base">用戶管理</CardTitle>
                </div>
                <ChevronRight className="text-muted-foreground" size={16} />
              </CardHeader>
              <CardContent>
                <CardDescription>顧問帳號清單;可重置任何人的密碼(僅 admin)。</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {isAdmin(role) ? (
          <Link href="/settings/student-statuses">
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tags className="text-muted-foreground" size={20} />
                  <CardTitle className="text-base">學生狀態</CardTitle>
                </div>
                <ChevronRight className="text-muted-foreground" size={16} />
              </CardHeader>
              <CardContent>
                <CardDescription>學生卡片徽章、篩選器、狀態變更選單的全公司清單。</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
