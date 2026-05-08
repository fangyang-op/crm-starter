import { ChefHat, type LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  title?: string
  hint?: string
  /** 頁面標題 icon — 顯示在卡片外、頁面 H1 旁邊。 */
  pageTitle?: string
  pageIcon?: LucideIcon
}

export function UnderConstruction({ title, hint, pageTitle, pageIcon: PageIcon }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
      {pageTitle ? (
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {PageIcon ? <PageIcon size={22} className="text-primary" /> : null}
            {pageTitle}
          </h1>
        </header>
      ) : null}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="rounded-full bg-amber-100 p-4 text-amber-700">
            <ChefHat size={36} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">營運正在料理中</h2>
            {title ? <p className="text-sm text-muted-foreground">{title}</p> : null}
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            {hint ?? '此功能正在開發中,敬請期待。'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
