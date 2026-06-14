import { test } from '@playwright/test'

import { hasSupabaseCreds } from '../integration/helpers/supabase'
import { login } from '../e2e/helpers'

// Repeatable navigation-timing harness (Profiler). Logs in as fe_manager (sees
// all data), then measures client-side <Link> navigation per hot route:
//   - rsc: RSC payload requests (?_rsc=) fired FOR THE TARGET ROUTE during the nav
//   - ms : wall-clock from click to network idle
// The KEY before/after signal is REVISIT (click a sidebar link to a page already
// visited this session): with staleTimes.dynamic=0 (today) it refetches (rsc>=1);
// with staleTimes.dynamic>0 it is served from the Router Cache (rsc=0) → instant.
// NOTE: page.goBack() is NOT used — it hits the browser BFCache and masks the
// Router Cache behavior. Local numbers are a relative proxy (same machine, warm
// DB, 4 fixture students); absolute prod latency must be read off Vercel.
// Run: `npm run perf:nav` (before) and again (after) to compare.

test.skip(!hasSupabaseCreds, 'perf harness needs Supabase creds + E2E_TEST_PASSWORD')

const ROUTES = ['/students', '/schools', '/applications', '/workload', '/reports', '/']

type Row = { phase: string; route: string; ms: number; rsc: number }

test('nav-timing baseline/after', async ({ page }) => {
  // Count RSC requests per target route (reset before each nav).
  let target = ''
  let rsc = 0
  page.on('request', (r) => {
    if (!r.url().includes('_rsc=')) return
    try {
      if (new URL(r.url()).pathname === target) rsc++
    } catch {
      /* ignore */
    }
  })

  const rows: Row[] = []

  const navByLink = async (route: string, phase: string): Promise<void> => {
    target = route
    rsc = 0
    const t0 = Date.now()
    const link = page.locator(`nav a[href="${route}"]`).first()
    if (await link.count()) {
      await Promise.all([
        page.waitForURL((u) => new URL(u).pathname === route, { timeout: 30_000 }),
        link.click(),
      ])
    } else {
      await page.goto(route)
    }
    await page.waitForLoadState('networkidle').catch(() => {})
    rows.push({ phase, route, ms: Date.now() - t0, rsc })
  }

  await login(page, 'fe_manager') // lands on '/'
  await page.waitForLoadState('networkidle').catch(() => {})

  // COLD: first visit to each route this session.
  for (const route of ROUTES) await navByLink(route, 'cold')

  // REVISIT: click the /students sidebar link again (already visited) — this is
  // the "切換 sidebar 又重讀" symptom. rsc>=1 means it refetched.
  await navByLink('/schools', 'setup') // move away first
  await navByLink('/students', 'REVISIT')

  // STUDENT DETAIL cold (the 42-query render).
  const detailLink = page.locator('a[href^="/students/"]').filter({ hasNotText: '新增' }).first()
  if (await detailLink.count()) {
    target = '__detail__'
    rsc = 0
    let detailRsc = 0
    const onReq = (r: { url(): string }) => {
      if (r.url().includes('_rsc=') && /\/students\/[0-9a-f-]+/.test(new URL(r.url()).pathname))
        detailRsc++
    }
    page.on('request', onReq)
    const td = Date.now()
    await Promise.all([
      page.waitForURL(/\/students\/[0-9a-f-]+$/, { timeout: 30_000 }),
      detailLink.click(),
    ])
    await page.waitForLoadState('networkidle').catch(() => {})
    rows.push({ phase: 'cold', route: '/students/[id]', ms: Date.now() - td, rsc: detailRsc })
  }

  const table = rows
    .filter((r) => r.phase !== 'setup')
    .map(
      (r) =>
        `${r.phase.padEnd(8)} ${r.route.padEnd(18)} ${String(r.ms).padStart(6)}ms  rsc=${r.rsc}`,
    )
    .join('\n')
  // eslint-disable-next-line no-console
  console.log(`\n===== NAV TIMING =====\n${table}\n======================\n`)
})
