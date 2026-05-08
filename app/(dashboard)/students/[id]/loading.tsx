// 學生詳情頁的骨架 — 抓「頂部標題列 + 狀態 pill + tab 列 + 主內容卡片」
// 的整體形狀。學生詳情頁有大量 join 與 server-side 計算,Suspense 階段
// 顯示這個骨架避免空白等待。

export default function StudentDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 w-20 animate-pulse rounded-t-md bg-muted" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
