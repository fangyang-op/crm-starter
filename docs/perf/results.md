# 效能優化結果 — Tier 1(低風險、高槓桿)

日期:2026-06-14
分支:`perf/tier1`(off `main`)｜before 基線見 [`docs/perf/baseline.md`](./baseline.md)
決策(Marcus):`staleTimes.dynamic = 15s`(保守);學生詳細頁 tab 延後渲染 → **獨立後續 PR**。

> 本層全部改動**留在伺服器 / 設定層**,未碰任何 Stage 0–3 資安紅線(見 §資安驗證)。

---

## 1. 做了什麼 + 為什麼 + before/after

| # | 改動 | 檔案 | before → after | 證據 |
|---|---|---|---|---|
| 1 | **client Router Cache TTL** `experimental.staleTimes:{dynamic:15,static:300}` | `next.config.mjs` | 重訪/上下頁**重抓** → **15s 內快取命中、瞬間** | harness:**REVISIT `/students` rsc 1 → 0** |
| 2 | **`React.cache` 去重 auth**:`getCurrentUser`/`getCurrentProfile` | `lib/supabase/auth.ts`(新)+ `layout.tsx`、`page.tsx`(home)、`schools/page.tsx` | 同一次 render 內 `getUser()` 2–3 次 + profiles 2–3 次 → **各 1 次**(middleware 那次仍獨立,安全閘門不動) | 程式:layout/page/schools 共用 cached helper |
| 3 | **`loading.tsx` 覆蓋** 3 → **10** 條路由 | 新增 home、applications、workload、reports、uat、settings、duplicate-overrides(共用 `components/shared/page-skeleton.tsx`) | 導航全白等 await 鏈 → **點擊即見 skeleton** + 給 `<Link>` prefetch 邊界 | `find app -name loading.tsx` = 10 |
| 4 | **home 三查詢平行化** + 用 cached user(移除冗餘第 3 次 getUser) | `app/(dashboard)/page.tsx` | `getUser→statuses→count→count` 序列 → `Promise.all`(statuses‖dup-count)後接 dependent count | 程式 |
| 5 | **schools profiles‖list 平行化** + cached profile | `app/(dashboard)/schools/page.tsx` | `getUser→profiles→schools` 序列 → role lookup 與 list 查詢 `Promise.all` | 程式 |
| 6 | **熱查詢索引 migration** `0047_perf_tier1_indexes.sql` | `supabase/migrations/` | students `created_at`(排序)/ status partial / unassigned-backend / schools 排序 / school_programs / uat active | **⚠️ 待 Marcus 在 Supabase 手動套用** |

**移除的小過度抓取**:layout 的 `profiles` select 拿掉未使用的 `avatar_url`。

---

## 2. 量測對照(harness:`npm run perf:nav`,prod build / `next start`,本機)

| 路徑 | before rsc | after rsc | 意義 |
|---|---|---|---|
| **REVISIT `/students`** | **1**(重抓) | **0**(快取命中) | ✅ Tier 1 核心目標達成:重訪不再打伺服器 |
| cold `/students` 等 | 1–2 | 1–2 | 首訪仍取資料(預期);不變 |

> 本機絕對 ms 是相對代理(同機、暖 DB、4 筆 fixture);`rsc` 次數是與環境無關的架構訊號。**正式站動態路由 TTFB / Function duration** 仍需 Marcus 量(方法見 baseline §6),且 #6 索引**套用後**才會反映在大表查詢。

**bundle**:本層未增前端資料層,bundle 實質不變(`page-skeleton` 極小)。詳細頁 247kB 的 code-split 留待 Tier 2/3。

---

## 3. 資安驗證(Verifier checklist — 全過)

- `npm run typecheck` ✅ / `lint` ✅ / `build` ✅
- **unit 60 / integration 22 / e2e 12 全綠**(跨角色 RLS、最小揭露、核心流程、路由保護皆未回歸)
- `grep select('*')` = **0**(Stage 2-C 維持)
- 無 `service_role` / `lib/crypto` / `createAdminClient` 進入任何 `'use client'` 檔
- `createSignedUrl` 僅存在於 server actions;`lib/supabase/auth.ts` 標 `import 'server-only'`
- middleware 的 `getUser()`(驗證 JWT 的安全閘門)**未動** — React.cache 只去重 render tree 內的重複呼叫,不弱化驗證

---

## 4. 待 Marcus

1. **套用 `supabase/migrations/0047_perf_tier1_indexes.sql`**(CONCURRENTLY,逐條貼;見檔內說明)→ 之後 `ANALYZE`。
2. **量正式站 after**:部署後用 baseline §6 方法量動態路由 TTFB / 冷啟動,填回本檔對照。
3. merge 前 CI 三綠。

---

## 5. 還能再快(本輪未做)— 後續清單(效益 / 風險)

| 項目 | 層 | 預期效益 | 風險 | 備註 |
|---|---|---|---|---|
| **學生詳細頁 tab 延後渲染**(Suspense/gating) | Tier 1 後續(已約定獨立 PR) | **大**:42 → ~12 round-trip/詳細頁 | 中(改 render 結構) | 詳細頁是最重路由(247kB / 42 查詢) |
| **client 資料快取**(TanStack Query / SWR) | Tier 2 | 中–大:已看過的列表/詳細切回瞬間、SWR 背景更新 | 中(動架構;需守 RLS + 補跨角色快取測試) | 只快取非敏感讀取、anon+session、RLS 仍生效 |
| students 列表 `count:'exact'` → `planned`/`estimated` | Tier 2/3 | 中(大表 count 是主成本) | 低–中(總頁數變估計值) | 需確認 UI 可接受估計總數 |
| students 列表 `profiles` 縮成本頁 ids(`.in(ids)`) | Tier 2 | 小–中(避免全 profiles 掃) | 低 | 需把 profiles 移到第 2 round(依賴學生頁結果) |
| ILIKE 搜尋 `pg_trgm` GIN 索引 | Tier 3 | 中(搜尋全掃 → 索引) | 低–中(寫入成本 + 加 extension) | migration 0047 註解已備 SQL |
| 詳細頁 bundle code-split(247kB) | Tier 3 | 小–中(首屏 JS) | 低 | tab 元件動態 import |
| PPR / 靜態 shell | Tier 3 | 視情況 | 中 | 邊際效益遞減,選配 |
| middleware `getUser` 每請求 | — | — | — | **不動**:getUser 驗證 JWT 是安全設計;改 getSession 會弱化安全,不建議 |

---

## 6. 文件回寫(Marcus 回來處理)

- **Notion〈一、架設、部署與修改紀錄〉**:新增「效能優化 v2 — Tier 1」:staleTimes(15s)、React.cache auth 去重、loading.tsx 全覆蓋、home/schools 平行化、索引 migration 0047(待套用)。
- **〈序〉技術導覽**:架構描述補「client Router Cache(staleTimes 15s)+ React.cache 去重 auth」;確認「TanStack Query 尚未導入」仍正確(Tier 2 才導)。
- **〈五〉移交文件**:若描述「每次導航都重抓」需更新為「重訪 15s 內快取命中」;索引清單同步(套用後)。
- 依「序→七 全文一致性」慣例檢查各處效能描述。
