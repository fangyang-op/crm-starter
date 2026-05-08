// 路由切換時,Server Component 在 fetch 階段先顯示這個骨架,使用者
// 不會看到「卡 2-3 秒沒反應」的感覺。樣式只是抓大略形狀,不追求像素
// 完全對齊 — 真實內容到位後 React 會直接 swap。

export default function StudentsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </header>

      <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card p-1.5 shadow-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-10 w-20 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <div className="flex gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-3 w-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b px-5 py-3 last:border-0">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: j === 1 ? '12rem' : `${5 + (j % 3) * 2}rem` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
