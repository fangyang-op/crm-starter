import { LineChart } from 'lucide-react'

import { UnderConstruction } from '@/components/shared/under-construction'

export default function ReportsPage() {
  return (
    <UnderConstruction
      pageTitle="營收績效管理"
      pageIcon={LineChart}
      title="報表"
      hint="績效、轉換漏斗、佣金彙總報表將於 Phase 5 推出。"
    />
  )
}
