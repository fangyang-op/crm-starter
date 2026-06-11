import { redirect } from 'next/navigation'

import { isAdmin, type UserRole } from '@/lib/constants/roles'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // 權限矩陣 §3.1／§6.2:整個 /settings(及子頁:學生狀態、名單來源/轉介人、
  // 服務方案、用戶管理)為 admin-only。原本誤用 isManagerOrAdmin 讓主管也進得去
  // (UAT 發現),此處收緊為僅 admin;manager 與其他角色一律 redirect 回 /。
  if (!profile || !isAdmin(profile.role as UserRole)) {
    redirect('/')
  }

  return <>{children}</>
}
