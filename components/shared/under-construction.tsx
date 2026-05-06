import { ChefHat } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  title?: string
  hint?: string
}

export function UnderConstruction({ title, hint }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
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
