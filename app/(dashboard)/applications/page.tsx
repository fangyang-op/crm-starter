import { FileCheck } from 'lucide-react'

import { UnderConstruction } from '@/components/shared/under-construction'

export default function ApplicationsPage() {
  return (
    <UnderConstruction
      pageTitle="申請進度看板"
      pageIcon={FileCheck}
      title="申請總覽"
      hint="跨學生的申請看板將在後續階段推出。目前可從個別學生詳情頁的「申請」分頁追蹤進度。"
    />
  )
}
