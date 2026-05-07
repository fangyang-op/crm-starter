export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // v1.3 §1.1: soft brand-tinted gradient (top-left blue/indigo,
    // bottom-right blush). Children render their own card; we just provide
    // the centered viewport + background.
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F9FAFB 50%, #FFF0F3 100%)',
      }}
    >
      {children}
    </div>
  )
}
