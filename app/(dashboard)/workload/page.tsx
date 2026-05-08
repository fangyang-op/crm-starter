import { BarChart3 } from 'lucide-react'

import { UnderConstruction } from '@/components/shared/under-construction'

export default function WorkloadPage() {
  return (
    <UnderConstruction
      pageTitle="後端量能管理"
      pageIcon={BarChart3}
      title="Workload"
      hint="顧問工作量分布視圖將於 Phase 5 推出。"
    />
  )
}
