# CRM 修改規格 — 測試回報專區

> **目的**：在 CRM 系統內建立封測回報功能，讓封測顧問在系統內直接填寫測試結果，Admin 可統一查看與匯出。
> **執行原則**：同前（每項獨立 commit、schema 變更寫 migration、不確定自行判斷）
> **參考 DEMO**：`docs/specs/referral-portal-v2.html`（視覺風格參考）
> **注意**：此功能為封測期間限定入口，未來可改為「問題回報專區」，現階段先以封測為主。

---

## 1. Sidebar 新增入口

**位置**：`components/layout/sidebar.tsx`

**修改內容**：
- 在 Sidebar nav 加入「測試回報」項目，僅在 `APP_ENV === 'beta'` 或 Admin 在設定後台開啟「封測模式」時顯示
- icon：lucide `ClipboardCheck`
- 路由：`/uat`
- badge：顯示該用戶尚未完成的測試項目數（即時查詢）
- 所有角色皆可看到此入口（Admin / 主管 / 顧問）

**ASSUMPTION**：封測模式開關放在 `settings` 表的 `uat_mode_enabled boolean`，Admin 可在設定後台切換。若欄位不存在，新增 migration。

```sql
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS uat_mode_enabled boolean NOT NULL DEFAULT true;
```

**驗收**：
- [ ] Sidebar 出現「測試回報」nav item，有 badge 顯示未完成數
- [ ] badge 在全部填完後消失
- [ ] commit：`feat: [1] sidebar 新增測試回報入口`

---

## 2. DB Schema

**Migration 檔案**：`supabase/migrations/YYYYMMDDHHMMSS_create_uat_tables.sql`

```sql
-- 測試章節定義表（seed 進去，不讓使用者自行新增）
CREATE TABLE uat_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  title_zh text NOT NULL,
  icon text NOT NULL,                      -- lucide icon name
  description text NOT NULL,
  target_roles text[] NOT NULL DEFAULT '{}', -- [] = 所有角色
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 測試項目定義表
CREATE TABLE uat_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES uat_chapters(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  item_code text UNIQUE NOT NULL,          -- e.g. '1-01', '2-03'
  step_description text NOT NULL,          -- 測試步驟
  expected_result text NOT NULL,           -- 預期結果
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 使用者回填結果表
CREATE TABLE uat_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES uat_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  result text NOT NULL CHECK (result IN ('pass', 'fail')),
  note text,
  screenshot_path text,                    -- Supabase Storage path（選填）
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)                -- 每人每項只有一筆
);

-- RLS
ALTER TABLE uat_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE uat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE uat_results ENABLE ROW LEVEL SECURITY;

-- 所有登入者可讀章節與項目定義
CREATE POLICY "chapters_read" ON uat_chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_read" ON uat_items FOR SELECT TO authenticated USING (true);

-- 使用者只能讀寫自己的結果；Admin 可讀所有結果
CREATE POLICY "results_own" ON uat_results FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "results_admin_read" ON uat_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Storage**：
- 新增 bucket `uat-screenshots`（所有登入者可上傳自己的截圖，Admin 可讀全部）

**需手動到 Supabase Dashboard 執行**：
- `..._create_uat_tables.sql`

**驗收**：
- [ ] 三張表建立完成，RLS 設定正確
- [ ] Storage bucket `uat-screenshots` 建立
- [ ] commit：`feat: [2] UAT 相關 DB tables + RLS`

---

## 3. Seed 測試章節與項目資料

**Migration 檔案**：`supabase/migrations/YYYYMMDDHHMMSS_seed_uat_data.sql`

依照以下資料 INSERT（完整 8 個章節，共 32 個測試項目）：

### 章節一｜登入系統
- target_roles: [] （所有角色）
- 1-01：開啟系統網址，確認登入頁外觀｜預期：漸層背景、品牌色條、ShieldCheck icon 都有顯示
- 1-02：點擊 Sidebar 收合按鈕｜預期：收合至 64px，有平滑動畫；hover nav item 出現 tooltip
- 1-03：重整頁面後確認 Sidebar 狀態｜預期：維持上次的收合/展開狀態（localStorage 記憶）
- 1-04：點擊「申請」「Workload」「報表」｜預期：顯示「營運正在料理中」，不顯示 404

### 章節二｜設定後台
- target_roles: ['admin']
- 2-01：用一般顧問帳號輸入 /settings 網址｜預期：被 redirect 回首頁，無法進入
- 2-02：用 Admin 新增學生狀態（自訂名稱＋顏色）｜預期：新狀態出現在列表，可拖拉排序
- 2-03：停用剛才新增的狀態｜預期：學生頁面下拉選單不再出現此狀態
- 2-04：新增名單來源並關聯轉介人｜預期：關聯建立成功；建立學生時選此來源，轉介人自動帶入
- 2-05：Admin 重置某帳號的密碼｜預期：顯示新密碼一次（僅本次），activity_log 記錄此操作

### 章節三｜建立學生名單
- target_roles: [] （所有角色）
- 3-01：確認「當前學歷」下拉選項｜預期：共 13 個選項，國一～在職人士，順序正確
- 3-02：在金額欄位輸入 4000｜預期：顯示 4000，不出現 04000，欄位無上下箭頭
- 3-03：選擇「家長代填」，填寫代填人資料後送出｜預期：學生主頁出現「關係人」卡片
- 3-04：回到學生列表，點擊某列任意位置｜預期：整列可點擊，進入學生詳情頁

### 章節四｜重複名單防治
- target_roles: [] （所有角色）
- 4-01：新建學生，輸入已存在的手機號碼後移出欄位｜預期：出現 amber 警示，顯示現有學生資訊
- 4-02：有警示但未確認，直接點「送出」｜預期：表單攔截，toast 提示
- 4-03：輸入 0912-345-678（含破折號）｜預期：觸發與 0912345678 相同的重複偵測
- 4-04：輸入 +886912345678｜預期：同樣觸發重複偵測

### 章節五｜成交建立
- target_roles: [] （所有角色）
- 5-01：進入學生主頁，確認選校表、文件、申請 tab 狀態｜預期：三個 tab 顯示鎖頭
- 5-02：建立成交，確認轉介人欄位｜預期：若名單有填轉介人，自動帶入且有 hint 提示
- 5-03：成交後再次確認三個 tab｜預期：三個 tab 解鎖，可正常進入

### 章節六｜選校表
- target_roles: [] （所有角色）
- 6-01：新增夢幻、合適、保底各一所學校｜預期：夢幻淡粉、合適淡黃、保底淡藍；無「衝刺」類別
- 6-02：拖拉卡片到不同 tier 區塊｜預期：卡片 tier 更新，背景色改變
- 6-03：在搜尋欄輸入中文校名（如「哈佛」）｜預期：下拉選單即時縮小範圍
- 6-04：輸入英文「Har」｜預期：不區分大小寫，即時縮小範圍

### 章節七｜申請追蹤
- target_roles: [] （所有角色）
- 7-01：狀態切換為「錄取」，上傳錄取通知書（PDF）｜預期：出現上傳按鈕；上傳成功後顯示查看/重新上傳
- 7-02：狀態切換為「放棄錄取」｜預期：已上傳的錄取通知書仍然顯示，不被隱藏
- 7-03：狀態切換為「確定入學」｜預期：學生狀態自動更新為「入學準備」；已上傳文件仍顯示
- 7-04：勾選「有獲得獎學金」，填入金額並上傳通知信｜預期：展開欄位；金額無前導零；PDF 上傳成功

### 章節八｜申請準備 Checklist
- target_roles: [] （所有角色）
- 8-01：確認預設文件列表與每列順序｜預期：13 項文件；順序：勾選框→狀態燈→狀態文字→文件名稱；兵役證明預設未勾選
- 8-02：上傳一份文件後確認 Panel 行為｜預期：Panel 維持開啟；狀態更新；出現短暫綠色提示
- 8-03：確認狀態燈四種顏色｜預期：待上傳（灰）、已上傳（藍）、已驗證（綠）、退件（紅）
- 8-04：hover「兵役證明」的注意事項｜預期：出現完整說明

**需手動到 Supabase Dashboard 執行**：
- `..._seed_uat_data.sql`

**驗收**：
- [ ] 8 個章節、32 個測試項目 seed 完成
- [ ] commit：`feat: [3] seed UAT 章節與測試項目資料`

---

## 4. 測試回報頁面（封測人員視角）

**位置**：`app/(dashboard)/uat/page.tsx`

### 4.1 頁面結構

```
┌─ 封測注意事項 banner（amber）─────────────────────────────┐
│ 學生 Portal / 轉介人 Portal 尚未開放；2.12 一鍵打包開發中 │
└───────────────────────────────────────────────────────────┘

[章節 tab 1] [章節 tab 2] ... [章節 tab 8]
← 各 tab 完成後變綠色；未完成顯示 pending badge →

┌─ 章節卡片 ──────────────────────────────────────────────┐
│ 標題 + icon + 功能說明文字                               │
│ 進度條（X / N 完成）                                    │
├──────────────────────────────────────────────────────────┤
│ [1-01] 測試步驟文字                                      │
│        預期：xxxxx                                       │
│        [✓ 通過] [✗ 失敗]                                │
│        （選了之後展開）備註文字框 + 截圖上傳（選填）     │
├──────────────────────────────────────────────────────────┤
│ ...                                                      │
├──────────────────────────────────────────────────────────┤
│                    [送出本章節]                           │
└──────────────────────────────────────────────────────────┘
```

### 4.2 互動邏輯

1. **章節 tab**：點擊切換顯示的章節卡片
   - 完成送出的章節 tab 變綠色（`bg-green-50 text-green-700`）
   - 尚未開始的 tab 顯示灰色
   - 進行中的 tab 顯示品牌色

2. **結果選擇**：
   - 點擊「通過」或「失敗」後，對應按鈕高亮
   - 選擇後自動展開備註文字框（`textarea`，選填）
   - 備註下方顯示截圖上傳區（使用既有 `FileUploadButton` 元件，`accept="image/*"`，非必填，最大 5MB）
   - 結果即時儲存（`upsert` 到 `uat_results`，不需要等到送出章節）

3. **進度條**：即時更新，顯示「X / N 完成」

4. **送出章節**：
   - 該章節所有項目都有填結果才能點送出
   - 送出後 toast 提示，自動跳下一章節
   - 若已是最後章節，顯示「所有章節已完成，感謝您的回報！」

5. **再次進入**：若已有填寫紀錄，自動帶入已填的結果（`upsert` 邏輯，可修改）

### 4.3 資料查詢

```ts
// 進入頁面時載入
const { data: chapters } = await supabase
  .from('uat_chapters')
  .select(`
    *,
    uat_items (
      *,
      uat_results (result, note, screenshot_path)
    )
  `)
  .eq('uat_items.uat_results.user_id', currentUserId)
  .eq('is_active', true)
  .order('sort_order')
```

**驗收**：
- [ ] 頁面顯示 8 個章節 tab
- [ ] 通過 / 失敗選擇後展開備註 + 截圖上傳
- [ ] 截圖上傳成功後顯示縮圖預覽
- [ ] 進度條即時更新
- [ ] 送出後自動跳下一章節
- [ ] 重新進入頁面，已填結果自動帶入
- [ ] commit：`feat: [4] 測試回報頁面（封測人員視角）`

---

## 5. Admin 總覽頁面

**位置**：`app/(dashboard)/uat/admin/page.tsx`（僅 Admin 可進入）

### 5.1 頁面結構

```
[匯出 CSV] ← 右上角

統計卡片：測試人員 | 章節完成率 | 通過項目 | 失敗項目

┌─ 人員進度總表 ──────────────────────────────────────────┐
│ 姓名 | 角色 | 進度 | 通過 | 失敗 | 未填 | 狀態分布        │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘

┌─ 失敗項目清單 ──────────────────────────────────────────┐
│ 項目編號 | 測試步驟 | 失敗人數 | 備註 | 截圖              │
│ ...（依失敗人數降冪排序）                                │
└──────────────────────────────────────────────────────────┘
```

### 5.2 匯出 CSV

CSV 欄位：
```
姓名, 角色, 章節, 項目編號, 測試步驟, 結果, 備註, 截圖連結, 填寫時間
```

實作：Server Action 產生 CSV 字串，前端用 `Blob` + `URL.createObjectURL` 下載。

### 5.3 RLS 保護

```ts
// app/(dashboard)/uat/admin/page.tsx
import { redirect } from 'next/navigation'
const profile = await getCurrentProfile()
if (profile.role !== 'admin') redirect('/')
```

**驗收**：
- [ ] 統計卡片數字正確（即時查詢）
- [ ] 人員進度表顯示所有封測人員
- [ ] 失敗項目清單依失敗人數排序
- [ ] 匯出 CSV 功能正常，欄位完整
- [ ] 非 Admin 無法進入此頁
- [ ] commit：`feat: [5] Admin UAT 總覽頁面`

---

## 6. Sidebar badge 計算

**位置**：`components/layout/sidebar.tsx`（或 layout server component）

```ts
// 計算該用戶尚未填寫的項目數
const { count } = await supabase
  .from('uat_items')
  .select('id', { count: 'exact' })
  .eq('is_active', true)
  .not('id', 'in', `(
    SELECT item_id FROM uat_results WHERE user_id = '${userId}'
  )`)
```

- 數字 > 0：顯示紅色 badge
- 數字 = 0：badge 隱藏

**驗收**：
- [ ] Sidebar badge 顯示正確未填數
- [ ] 全部填完後 badge 消失
- [ ] commit：`feat: [6] sidebar UAT badge 計算`

---

## 需手動到 Supabase Dashboard 執行的 Migration 清單

1. `..._create_uat_tables.sql`（第 2 項）
2. `..._seed_uat_data.sql`（第 3 項）

---

## 驗收清單（全部完成後）

- [ ] Sidebar 出現「測試回報」入口，badge 數字正確
- [ ] 封測人員可切換章節、填寫通過/失敗、附備註與截圖
- [ ] 即時儲存，重新進入自動帶入既有結果
- [ ] 章節全填完送出後跳下一章
- [ ] Admin 可在 `/uat/admin` 查看所有人進度與失敗項目
- [ ] 匯出 CSV 功能正常
- [ ] 非 Admin 無法進入 `/uat/admin`
- [ ] Migration 與 seed 清單產出
- [ ] 所有修改均有獨立 commit
