// Generic route skeleton rendered by loading.tsx while a Server Component
// fetches. Page-shape-agnostic (header + a few content blocks) — perf Tier 1
// added loading.tsx to the hot routes that lacked one, so navigation paints a
// skeleton instantly instead of blocking on the server await chain (and the
// default <Link> prefetch gets a boundary to warm).
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    </div>
  )
}
