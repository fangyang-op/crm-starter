# 04. 開發路線圖(Phase 0-7)

> Claude Code 動工前**永遠先讀此文件**,確認當前 Phase 與下一個未完成項目。  
> 完成一項就在 `[ ]` 改成 `[x]`,並 commit:`docs(roadmap): mark X.Y as done`。

---

## 進度總覽

| Phase | 主題 | 預估時程 | 狀態 |
|---|---|---|---|
| 0 | 基礎建設 | 3-5 天 | 🔵 待開始 |
| 1 | 學生主檔 + 招生 MVP | 1-2 週 | ⚪ 未開始 |
| 2 | 選校表 | 1 週 | ⚪ 未開始 |
| 3 | 後端文件管理 + 字數帳本 | 1-2 週 | ⚪ 未開始 |
| 4 | 申請追蹤 + 成績 + 佣金 | 1 週 | ⚪ 未開始 |
| 5 | 儀表板 + Workload + 公告 | 1 週 | ⚪ 未開始 |
| 6 | 整合舊 Beta(院校庫/榜單/知識庫) | 1 週 | ⚪ 未開始 |
| 7 | AI 整合(Claude API + MCP) | 依需求 | ⚪ 未開始 |

---

## Phase 0:基礎建設(3-5 天)⭐ 起點

> 目的:把專案骨架搭起來,Auth + RLS 能跑,首頁可登入。

### 0.1 專案初始化
- [x] 用 `pnpm create next-app@latest` 建立 Next.js 14 專案(TypeScript + App Router + Tailwind)
- [x] 設定 `tsconfig.json` 路徑別名(`@/*` → `./*`)
- [x] 安裝 ESLint + Prettier + Husky + lint-staged
- [x] 建立 `.env.example` 與 `.env.local`(複製本專案附的)

### 0.2 Supabase 設定
- [ ] 在 [supabase.com](https://supabase.com) 開新專案(Region: Tokyo)
- [ ] 取得 URL / anon key / service_role key 填入 `.env.local`
- [ ] 安裝 `@supabase/supabase-js` 與 `@supabase/ssr`
- [ ] 建立 `lib/supabase/client.ts`(browser client)
- [ ] 建立 `lib/supabase/server.ts`(server client,讀 cookie)
- [ ] 建立 `lib/supabase/middleware.ts`(refresh JWT)
- [ ] 在根目錄 `middleware.ts` 整合上面 middleware

### 0.3 執行第一份 Migration
- [ ] 在 Supabase Dashboard → SQL Editor
- [ ] 貼上 `supabase/migrations/0001_init.sql` 並執行
- [ ] 驗證所有表都建立成功
- [ ] 建立第一個 admin 使用者(在 `auth.users` 註冊 → 手動 update `profiles.role = 'admin'`)

### 0.4 shadcn/ui 與設計系統
- [ ] 執行 `pnpm dlx shadcn@latest init`
- [ ] 安裝必要元件:`button` / `input` / `label` / `dialog` / `dropdown-menu` / `select` / `table` / `toast` / `card` / `badge` / `avatar` / `tabs` / `form`
- [ ] 設定 Tailwind 主色(見 [07-design-system.md](./07-design-system.md))
- [ ] 建立 `lib/utils.ts`(cn 函式 helper)

### 0.5 Auth 流程
- [ ] `app/(auth)/login/page.tsx` — 登入頁(email + password)
- [ ] `app/(auth)/login/actions.ts` — Server Action 處理登入
- [ ] 登入後自動 redirect `/`
- [ ] `app/(auth)/logout/route.ts` — 登出 API
- [ ] 未登入訪問 `(dashboard)/*` 自動踢回登入

### 0.6 Layout 骨架
- [ ] `app/(dashboard)/layout.tsx` — 側邊欄 + 頂部
- [ ] `components/layouts/sidebar.tsx` — 主導覽
- [ ] `components/layouts/topbar.tsx` — 使用者選單
- [ ] 依角色顯示不同導覽項(consultant 看不到 `/reports`)

### 0.7 型別產生
- [ ] 安裝 `supabase` CLI(`pnpm dlx supabase init` 後)
- [ ] 執行 `supabase gen types typescript --project-id YOUR_ID > types/database.ts`
- [ ] 在 `lib/supabase/client.ts` import `Database` 型別

### 0.8 部署到 Vercel
- [ ] 推到 GitHub
- [ ] 連 Vercel,設定環境變數
- [ ] 確認首次部署成功 + 可登入

✅ **Phase 0 完成標準**:可以登入、看到空的首頁、有側邊欄、登出可用。

---

## Phase 1:學生主檔 + 招生 MVP(1-2 週)⭐ 第一個可用版

> 目的:前端顧問可以新增學生、看自己的學生、改狀態、建立成交。

### 1.1 學生 CRUD
- [ ] `app/(dashboard)/students/page.tsx` — 列表(分頁、搜尋、狀態篩選)
- [ ] `app/(dashboard)/students/new/page.tsx` — 新增表單
- [ ] `app/(dashboard)/students/[id]/page.tsx` — 學生 360° 主頁(分頁籤)
- [ ] `app/(dashboard)/students/actions.ts` — Server Actions(create / update / softDelete)
- [ ] zod validators(`lib/validators/student.ts`)

### 1.2 學生 360° 主頁(Tabs)
- [ ] **概覽**:基本資料、狀態、顧問、來源
- [ ] **時間軸**:讀 `activity_log`(空表先顯示空狀態)
- [ ] **成交**:Phase 1 核心(下面)
- [ ] **選校表**:Phase 2 預留 placeholder
- [ ] **文件**:Phase 3 預留
- [ ] **申請**:Phase 4 預留

### 1.3 狀態流轉
- [ ] 狀態變更下拉選單(僅顯示合法的 next state)
- [ ] 變更時 prompt 填寫備註
- [ ] 觸發器自動寫 `student_status_history` 與 `activity_log`
- [ ] UI 顯示狀態徽章(每狀態不同顏色)

### 1.4 名單來源 + 轉介人
- [ ] 新增/編輯學生時選擇 `lead_source_type`
- [ ] 動態欄位:選 `marketing_dept` / `consultant_referral` 顯示同事 dropdown
- [ ] 選 `external_referrer` / `brand_introduction` 顯示 referrer dropdown
- [ ] `app/(dashboard)/settings/referrers/` — 外部轉介人管理(僅 manager+)

### 1.5 顧問派發 / 交接
- [ ] 新增學生時 `frontend_consultant_id` 預設為當前使用者
- [ ] 主管可手動指定/改派
- [ ] 狀態變為 `closed_won` 時 prompt 派遣後端顧問
- [ ] 寫入 `consultant_handovers`

### 1.6 方案管理
- [ ] `app/(dashboard)/settings/plans/` — 方案 CRUD(僅 admin)
- [ ] 方案啟用/停用切換

### 1.7 成交流程
- [ ] 學生主頁「建立成交」按鈕
- [ ] 表單:選方案 → 加購字數 → 加購學校 → 優惠 → 簽約日 → 合約編號
- [ ] 自動計算 `final_amount`
- [ ] 績效拆分(下面)
- [ ] 寫入 `deals` + 自動產生 `word_quota_ledger`(initial + addon)
- [ ] 自動觸發學生狀態 → `closed_won`

### 1.8 績效拆分
- [ ] 預設 100% 給 `frontend_consultant`
- [ ] 「有轉介人」勾選 → 顯示拆分 UI(顧問 65 / 轉介 35,可改)
- [ ] 多筆 split 可加入(顧問 + 轉介 + 主管獎金)
- [ ] 約束:總和必須 = 100%
- [ ] 寫入 `deal_commission_splits`

### 1.9 權限驗證(關鍵!)
- [ ] 寫一個測試清單(見 [05-rls-policies.md](./05-rls-policies.md)):
  - [ ] 顧問 A 看不到顧問 B 的學生
  - [ ] 顧問 A 看不到顧問 B 的成交
  - [ ] 主管可看全部
  - [ ] 顧問改不到別人的學生

✅ **Phase 1 完成標準**:可以從新名單一路操作到成交,績效拆分正確記錄,權限隔離有效。

---

## Phase 2:選校表(1 週)

### 2.1 學校資料庫(共用)
- [ ] `app/(dashboard)/schools/page.tsx` — 學校列表(搜尋、國別篩選)
- [ ] `app/(dashboard)/schools/[id]/page.tsx` — 學校詳細頁
- [ ] 學校 CRUD(僅 manager+)
- [ ] `school_programs` 子表 CRUD

### 2.2 選校表(學生主頁分頁)
- [ ] `students/[id]/schools/` — 選校表分頁
- [ ] 「新建版本」按鈕(複製當前版本)
- [ ] 版本切換 dropdown
- [ ] 加入學校(從 schools 搜尋)
- [ ] 拖拉排序 + 設定 tier(reach/match/safety/dream)
- [ ] 鎖定版本(`is_locked = true`,鎖後不可改)
- [ ] 設為當前版本(`is_current = true`)

✅ **Phase 2 完成標準**:可建立多版選校表、可滾動式調整、可鎖定確認版。

---

## Phase 3:後端文件管理 + 字數帳本(1-2 週)

### 3.1 加密工具
- [ ] `lib/crypto.ts` — AES-256-GCM 加解密(僅 server-side)
- [ ] 環境變數 `ENCRYPTION_KEY` 驗證

### 3.2 文件 Master
- [ ] `students/[id]/documents/` — 文件列表
- [ ] 新建 Master(類型 + 標題)
- [ ] Master 編輯器(簡易 textarea + 字數即時顯示)
- [ ] 儲存 = 新增一筆 `documents_master_versions`
- [ ] 與上版 diff(library: `diff` 套件)

### 3.3 文件 Variant(學校客製)
- [ ] 從 Master 「Fork to School」按鈕
- [ ] 選擇要套用的學校(從 applications 列出)
- [ ] 建立 Variant 並關聯 application
- [ ] Variant 編輯器(同 Master 編輯)

### 3.4 字數帳本 UI
- [ ] `students/[id]` 主頁顯示「剩餘字數」
- [ ] 點擊展開字數帳本明細(時間倒序)
- [ ] 「加碼字數」按鈕(僅 manager+ 或 frontend consultant)
- [ ] 寫入 `word_quota_ledger`(`bonus`)

### 3.5 觸發器
- [ ] `documents_master_versions` INSERT 時自動寫 ledger(`used`)
- [ ] `documents_variant_versions` INSERT 時自動寫 ledger(`used`)
- [ ] Master Fork 不扣字數(只寫 activity_log)

✅ **Phase 3 完成標準**:文件版本完整可追溯、字數每筆有紀錄、餘額正確。

---

## Phase 4:申請追蹤 + 成績 + 佣金(1 週)

### 4.1 從選校表展開申請
- [ ] 選校表 V_n 鎖定後 → 「展開為申請項」按鈕
- [ ] 為每個 list_item 建立一筆 `applications`(預設 `pending_send`)

### 4.2 申請追蹤
- [ ] `students/[id]/applications/` — 申請列表(看板式 + 列表切換)
- [ ] 每筆申請可編輯狀態、deadline、portal 帳密
- [ ] Portal 密碼填寫 → server action 加密後寫入
- [ ] 顯示時 mask + 「複製」按鈕(server action 解密回傳)

### 4.3 成績管理
- [ ] `students/[id]` 主頁加「成績」分頁
- [ ] 新增成績(類型 + 主分數 + sub_scores JSON)
- [ ] 上傳證書 → Supabase Storage

### 4.4 佣金紀錄
- [ ] application 狀態 = `enrolled` 且學校 `is_partner = true`
- [ ] 自動建立 `commission_records`(預期金額 = `partner_commission_rate × 學費`,需手填學費)
- [ ] 主管手動更新 `actual_amount` / `received_at`

✅ **Phase 4 完成標準**:申請進度透明、Portal 安全儲存、合作校自動列入佣金。

---

## Phase 5:儀表板 + Workload + 公告(1 週)

### 5.1 儀表板
- [ ] `app/(dashboard)/page.tsx` — 個人儀表板
  - 我負責的學生數(各狀態)
  - 本月成交數 / 本月績效金額
  - 即將到 deadline 的申請(7 天內)
  - 待處理事項
- [ ] 主管儀表板(看全公司)

### 5.2 Workload 計算
- [ ] DB View `consultant_workload` 計算每位後端顧問當前手上學生數 × 各狀態權重
- [ ] `app/(dashboard)/workload/page.tsx`(僅 manager+)
- [ ] 主管派發新學生時看到 workload 排行

### 5.3 公告系統
- [ ] 新增資料表 `announcements`(透過 migration 0002)
- [ ] 公告列表 + 新增(僅 admin)
- [ ] 登入後彈窗顯示未讀公告

✅ **Phase 5 完成標準**:主管能看到團隊全貌、Workload 自動算、公告可發布。

---

## Phase 6:整合舊 Beta(1 週)

> 從現有 Firebase Beta 平台遷移以下資料/功能。

### 6.1 院校資料庫遷移
- [ ] 寫一次性 script:Firestore → Supabase `schools` + `school_programs`
- [ ] 對齊欄位差異
- [ ] 驗證資料完整性

### 6.2 歷屆榜單
- [ ] DB View `historical_admissions`(從 `applications WHERE status = 'enrolled'` 聚合)
- [ ] `app/(dashboard)/admissions-history/page.tsx` — 篩選國別 / 系所 / 年度

### 6.3 知識庫
- [ ] 新增資料表 `knowledge_articles`(migration 0003)
- [ ] 簡易 markdown 編輯器
- [ ] 標籤、搜尋

### 6.4 問題討論
- [ ] 新增資料表 `discussions` + `discussion_replies`(migration 0004)
- [ ] 列表 + 留言 + tag 標記人

✅ **Phase 6 完成標準**:舊 Beta 全部功能整合到新 CRM,Beta 可下架。

---

## Phase 7:AI 整合(依需求)

### 7.1 Claude API 串接
- [ ] `app/api/ai/chat/route.ts` — Claude API proxy
- [ ] 環境變數 `ANTHROPIC_API_KEY`
- [ ] Rate limit + 用量追蹤

### 7.2 MCP Server
- [ ] 建立獨立的 MCP server 暴露 read-only DB query
- [ ] 限制只能讀去識別化資料

### 7.3 落點分析功能
- [ ] 學生主頁「AI 分析」按鈕
- [ ] 餵給 Claude:學生資料 + 歷屆榜單
- [ ] 回傳推薦學校清單
- [ ] 結果可一鍵加入選校表

### 7.4 智能查詢
- [ ] 全公司搜尋框
- [ ] 自然語言 → SQL(via Claude function calling)
- [ ] 「我有一位 GPA 3.25 / 托福 90 分的台科大學生想去美國讀 EE 研究所,推薦 5 所學校」

✅ **Phase 7 完成標準**:AI 助手可實際被顧問日常使用,分析品質達 80% 滿意度。

---

## Phase 完成檢查清單(通用)

每結束一個 Phase 必做:

- [ ] 所有勾選項目完成
- [ ] `pnpm typecheck` 零錯誤
- [ ] `pnpm build` 成功
- [ ] 新增的 RLS 經過手動角色測試
- [ ] 對應 docs 更新
- [ ] commit + push + Vercel 部署成功
- [ ] 找一位顧問試用 + 收集回饋
