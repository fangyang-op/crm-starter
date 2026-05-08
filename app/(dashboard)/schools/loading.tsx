export default function SchoolsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <div className="flex gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 w-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b px-5 py-3 last:border-0">
            {[1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: j === 1 ? '12rem' : `${4 + (j % 3) * 2}rem` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
