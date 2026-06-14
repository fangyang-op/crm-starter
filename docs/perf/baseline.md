# 效能基線(Stage — 效能診斷與優化｜階段 0：先量基線)

日期:2026-06-14
分支:`perf/tier1`(off `main` @ `938a5e1`)
方法:8-agent 診斷 workflow(逐路由 data-access + cache/config + auth-cost + 資安紅線盤點)+ 本機量測(prod build / `next start`)+ DB 索引/查詢分析 + 一個可重複的導航量測 harness(`npm run perf:nav`)。

> ⚠️ **量測能力邊界(誠實聲明)**:Agent **無法登入正式站**(`crm-starter-nine.vercel.app` 需帳密)、**無 Vercel / Supabase dashboard 權限**、**無 DB 直連字串**(`.env.local` 無 `DATABASE_URL`、無 `psql`)。因此:
> - **正式站動態路由的 TTFB / Function duration / 冷啟動** → 只能由 Marcus 在 Vercel 取得;本檔附「正式站量測方法」。
> - **DB query plan(EXPLAIN ANALYZE)** → 需 Marcus 在 Supabase SQL Editor 跑;本檔附 SQL。
> - 本檔的「數字」= 正式站**靜態頁** TTFB(curl,可量)+ **本機** nav harness(相對代理:同機、暖 DB、僅 4 筆 fixture 學生)+ **bundle**(build)+ **逐路由查詢數/瀑布**(原始碼分析,與環境無關,最具行動力)。

---

## 1. 主因假設:**確認**(並細化)

spec 推定主因:「每次導航都回伺服器 render + 跑 Supabase auth/RLS 查詢,且無 client 快取」。基線**證實**此假設,並找出更具體的放大因子:

| 證據 | 來源 |
|---|---|
| **無 client 快取**:`next.config.mjs` 未設 `experimental.staleTimes` → Next 15 預設 `dynamic:0`,動態路由的 RSC payload 一離開就丟棄 | config 稽核 |
| **重訪即重抓**:harness 點 sidebar 連結重訪 `/students` → **rsc=1**(重打伺服器);若有快取應為 0 | `npm run perf:nav` |
| **每次導航重複 auth**:`auth.getUser()` 在 middleware + layout(+ 部分 page)各打一次 = **每次導航 2–3 次 Supabase Auth network round-trip**,且 **全 repo 無 `React.cache`**(完全未去重) | auth-cost 稽核 + grep |
| **shell 瀑布**:每次導航固定鏈 `getUser(mw) → getUser(layout) → profiles.single() → [UAT ×3 並行]` ≈ 4 個序列網路 hop 才開始吐內容 | layout 分析 |
| **`loading.tsx` 僅 3 條路由**(students / students/[id] / schools);home、applications、workload、reports、uat、settings、duplicate-overrides **無** → 導航時整段 await 鏈跑完前畫面全白 | `find app -name loading.tsx` |
| **學生詳細頁 = 42 次查詢**:所有 tab(時間軸/成績/成交/選校/文件/申請)在伺服器端**每次都渲染**,即使使用者只看 overview → 約 30 次 round-trip 花在沒人點的 tab | detail 分析 |
| **學生列表 `count:'exact'` ×2 + `ORDER BY created_at` 無索引** → 學生量大時 count 全掃 + 排序成本線性上升 | list 分析 |

---

## 2. 正式站靜態頁 TTFB(可量的唯一正式站數字)

`curl` `https://crm-starter-nine.vercel.app/login`(靜態 PRERENDER,公開,免登入):

| 取樣 | TTFB | x-vercel-cache | 邊緣節點 |
|---|---|---|---|
| 冷(首打) | **~1.30s** | PRERENDER(MISS) | hkg1 |
| 暖 ×3 | **~0.15s** | HIT | hkg1 |

- `x-nextjs-prerender:1`、`x-nextjs-stale-time:300`:登入頁是**靜態**,由 CDN(hkg1,離量測者最近)服務;暖打 ~150ms。
- ⚠️ 這**不代表**動態路由(學生列表/詳細):那些每次都跑 Function(Tokyo/hnd1)+ Supabase + 無 CDN。動態路由的真實 TTFB **待 Marcus 量**(見 §6)。冷 ~1.3s 反映的是 CDN cache-miss 回源,可作為「冷啟動量級」參考。

---

## 3. 本機導航 harness(相對代理 — `npm run perf:nav`)

prod build + `next start`、登入 fe_manager(看全部)、4 筆 fixture 學生、同機暖 DB。**絕對 ms 不代表正式站**(無跨區網路/冷啟動);有意義的是 **rsc 次數**(client 快取行為,與環境無關):

| phase | route | ms(本機,代理) | **rsc(關鍵)** |
|---|---|---|---|
| cold | /students | 139 | 2(1 nav + 1 prefetch) |
| cold | /schools | 29 | 1 |
| cold | /applications | 96 | 1 |
| cold | /workload | 102 | 1 |
| cold | /reports | 95 | 1 |
| cold | / | 31 | 0 |
| **REVISIT** | **/students** | 25 | **1 ← 重訪仍重抓(症狀)** |

> **REVISIT rsc=1** 是本階段最關鍵的 before 數字:點 sidebar 重訪已看過的頁仍打伺服器。Tier 1 設 `staleTimes.dynamic>0` 後,目標 **rsc=0**(快取命中、瞬間)。harness 已存 `tests/perf/nav-timing.ts`,可重複跑做 after 對照。

---

## 4. Bundle(`npm run build`,First Load JS;與導航 TTFB 無直接關係,但記錄)

| 路由 | First Load JS | 註 |
|---|---|---|
| 共享 | 102 kB | baseline |
| /students | 116 kB | |
| **/students/[id]** | **247 kB** | 最重(詳細頁含所有 tab 元件) |
| /schools, /schools/[id] | 199–200 kB | |
| /students/[id]/edit, /new | 194 kB | |
| /reset-password | 192 kB | 靜態 |
| Middleware | 89.1 kB | 每請求執行 |

JS 量非主要瓶頸(都在可接受範圍);主因是**伺服器往返**,非首屏 JS。詳細頁 247kB 可在 Tier 2/3 再看(tab 元件 code-split)。

---

## 5. DB 索引盤點(由 migration DDL + query 分析;EXPLAIN 待 Marcus)

**已存在**(students):`status_id`、`deleted_at`、`frontend_consultant_id`、`backend_consultant_id`;applications/deals/schools 等多數 FK 已建。

**熱查詢缺索引(Tier 1 候選 migration)**:

| 表.欄 | 用於 | 現況 |
|---|---|---|
| `students.created_at` | 列表 `ORDER BY created_at`(每次) | **無索引** → 大表排序成本 |
| `students.status_id`(partial) | 列表 `.eq/.in(status_id)` 永遠帶 `deleted_at IS NULL` | 現有索引非 partial,無法對齊 |
| `schools.ranking_qs`, `name_en` | 列表 `ORDER BY` / ILIKE 搜尋 | 無 → 排序/搜尋全掃 |
| `school_programs.degree_level`, `program_name` | 詳細頁 `ORDER BY` | 無 |
| `uat_chapters.is_active`, `uat_items.is_active` | layout UAT badge(每次導航) | 無 |

> ILIKE 文字搜尋(`students.full_name/english_name/email`、`schools.*`)需 `pg_trgm` GIN 才走索引 — 列為 Tier 1(可選)/Tier 3。

---

## 6. 待 Marcus 量測 / 套用(Agent 做不到的)

1. **正式站動態路由 TTFB**:Vercel → Project → Observability/Logs,看 `/students`、`/students/[id]`、各 sidebar 路由的 **Function duration + 冷啟動比例**;或登入後 DevTools Network 看 document/RSC 請求 TTFB(冷導航 & 重訪)。
2. **EXPLAIN ANALYZE**(Supabase SQL Editor),例:
   ```sql
   EXPLAIN ANALYZE
   SELECT id, full_name, status_id, frontend_consultant_id, created_at
   FROM students WHERE deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 40;
   -- 看是否 Seq Scan + Sort(無 created_at 索引時會)
   ```
3. **索引 migration**:Tier 1 PR 會附 SQL,**待 Marcus 在 Supabase 手動套用**(GitHub→Supabase 不自動)。

---

## 7. 資安紅線(Tier 1/2 不得違反 — 盤點自 audit)

Tier 1 的所有改動(staleTimes / React.cache 去重 auth / loading.tsx / Promise.all / 索引)**全部留在伺服器**,不碰下列任何一條:

- `service_role` 僅 `lib/supabase/admin.ts`(`import 'server-only'`),5 個呼叫點皆在 admin 角色檢查後 — 不得快取跨角色、不得搬 client。
- `lib/crypto.ts`(`server-only`,`ENCRYPTION_KEY` 非 `NEXT_PUBLIC`):帳密 reveal/decrypt 僅 server action。
- signed URL:`createSignedUrl(path,60)` 走 anon RLS client,僅 server。
- 最小揭露 dup RPC、Stage 2-C select 收斂(已確認 0 個 `select('*')`)— 不得回頭抓全欄。
- RLS 是唯一資料安全層;Tier 2 若加 client 快取,只快取非敏感列表/詳細讀取、用 anon+session、RLS 仍生效,並補跨角色測試。

**Verifier checklist(每層後跑)**:`npm run build / lint / typecheck` + unit 60 / integration 22 / e2e 12 全綠;grep 確認無 `service_role`/`crypto`/`createSignedUrl` 進 `'use client'`;`select('*')` 仍為 0。

---

## 8. Tier 1 建議(低風險、高槓桿;依數據排序)— 待確認後實作

| # | 改動 | 對應症狀 | 風險 | 預期效益 |
|---|---|---|---|---|
| 1 | `next.config` 設 `experimental.staleTimes:{dynamic:N, static:300}` | 重訪/上下頁重抓(REVISIT rsc=1) | 極低(所有 mutation 已 `revalidatePath`,寫入即清快取) | 重訪 → **rsc=0、瞬間** |
| 2 | `lib` 加 `React.cache` 包 `getUser`+`profiles`,layout/page/子元件共用 | 每次導航 2–3× getUser + 重複 profiles | 低(純去重,行為不變) | 每次導航少 2–4 個序列 auth/DB hop |
| 3 | 補 `loading.tsx`:home、applications、workload、reports、uat、settings、duplicate-overrides | 導航全白等待 | 極低 | 點擊即見 skeleton(體感) |
| 4 | home page 3 查詢改 `Promise.all`;list 的 profiles 縮成本頁 ids | home 序列瀑布;list profiles 全表 | 低 | 少 1–2 hop |
| 5 | **索引 migration**(§5)→ **待 Marcus 套用** | 列表排序/篩選、UAT badge | 低(加索引) | 大表查詢 ↓ |
| 6 | (評估)詳細頁非 active tab 延後渲染(Suspense/gating) | 42 查詢/詳細頁 | 中(改渲染結構) | 初次載入少 ~25–30 round-trip |

**待確認決策(§8 之外)**:
- `staleTimes.dynamic` 值:audit 建議 30s;spec 要求「保守、避免過期太久」。可選 **15s(保守)/ 30s(體感更好)**。dup-override / 未派後端等「計數」在 30s 內可能略舊,但寫入會即時 revalidate。
- #6(tab 延後)算 Tier 1 還是獨立小 PR(它改渲染結構,風險中,但效益最大)。

> 下一步:Tier 1 單獨 PR(本檔 baseline = before;實作後 `docs/perf/results.md` = after 對照),CI 三綠 + 索引 SQL 標「待 Marcus 套用」後交付。
