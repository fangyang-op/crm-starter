# CRM 系統修改規格 v1.2

> **目的**：接續 v1.1 驗收通過後的第三輪修改，共 5 項。
> **執行原則**：同 v1.0（每項獨立 commit、schema 變更寫 migration、不確定自行判斷）
> **前置確認**：先 `git pull` 確認在 v1.1 最新 commit 後再開始。

---

## 1. 左側功能列視覺更新（展開/收合 + 陰影 + 底色）

**位置**：`app/(dashboard)/layout.tsx` + sidebar 元件（`components/layout/sidebar.tsx` 或類似路徑）

**修改內容**：

### 1.1 底色與陰影
```css
/* 左側 Sidebar */
background: #FFFFFF;
box-shadow: 4px 0 16px rgba(0, 0, 0, 0.06), 1px 0 0 #E5E7EB;
/* 讓 sidebar 浮在主畫面上方，產生層次感 */
position: relative;
z-index: 10;

/* 右側主畫面 */
background: #F9FAFC;
```

### 1.2 展開 / 收合功能
- Sidebar 頂部右側加一個 **收合按鈕**（`[|]` 圖示，參考截圖的 `⊣` icon，使用 lucide `PanelLeftClose` / `PanelLeftOpen`）
- 點擊後：
  - **展開**（預設）：顯示 icon + 文字，寬度 `240px`
  - **收合**：只顯示 icon，寬度 `64px`，hover 時出現 tooltip 顯示頁面名稱
- 狀態存在 `localStorage('sidebar-collapsed')`，重整後維持
- 收合/展開動畫：`transition: width 220ms ease`
- 收合時 logo 區域只顯示小圖示（不顯示文字）

### 1.3 參考截圖對應
對照使用者提供的截圖：
- Logo 區：左上角品牌名稱 + 副標，右側有收合按鈕
- Active 項目：品牌色背景（`#C7315C` 10% 透明度）+ 品牌色文字 + 左側 2px brand color bar
- 一般項目：灰色 icon + 深灰文字，hover 時輕底色
- 底部：用戶頭像 + 姓名 + 員工編號 + 個人設定 + 登出

**驗收**：
- [ ] Sidebar 底色 `#FFFFFF`，主畫面底色 `#F9FAFC`
- [ ] Sidebar 右側有向右的陰影，與主畫面產生層次區隔
- [ ] 收合按鈕功能正常，收合後只顯示 icon
- [ ] 收合狀態 localStorage 記憶，重整維持
- [ ] 收合時 hover 出現 tooltip
- [ ] 展開/收合有平滑動畫
- [ ] 寬度展開 240px / 收合 64px
- [ ] 完成後 commit：`feat: [1] sidebar 底色、陰影、展開收合`

---

## 2. 申請準備檔案：狀態燈恢復顯示中文文字

**位置**：Checklist 列表元件（`components/checklist/` 或 `app/(dashboard)/students/[id]/checklist/`）

**問題**：v1.1 修改後，狀態只剩圓點燈號，沒有中文文字。

**需求**：狀態燈 + 中文文字**同時顯示**，且燈在文字左側。

**修改內容**：
```tsx
// 目前（v1.1 後）
<StatusDot status={doc.status} />

// 修改為：燈 + 文字並排
<div className="flex items-center gap-1.5">
  <StatusDot status={doc.status} />
  <span className="text-xs font-medium" style={{ color: STATUS_COLOR[doc.status] }}>
    {STATUS_LABEL[doc.status]}
  </span>
</div>
```

狀態對應文字：
```ts
const STATUS_LABEL = {
  pending:  '待上傳',
  uploaded: '已上傳',
  verified: '已驗證',
  rejected: '退件',
}
const STATUS_COLOR = {
  pending:  '#9CA3AF',  // gray
  uploaded: '#2563EB',  // blue
  verified: '#059669',  // green
  rejected: '#DC2626',  // red
}
```

最終每列的左到右順序：**勾選框 → 〔狀態燈 + 狀態文字〕→ 文件名稱**

**驗收**：
- [ ] 每列顯示：勾選 → 狀態燈 → 狀態中文 → 文件名稱
- [ ] 四種狀態文字與顏色正確
- [ ] 完成後 commit：`feat: [2] checklist 狀態燈恢復中文文字`

---

## 3. 申請準備檔案：新增「兵役證明」

**位置**：`supabase/migrations/` + `document_templates` seed

**修改內容**：

### 3.1 新增 seed 項目
在 `document_templates` 表新增一筆：

```sql
INSERT INTO document_templates (
  code,
  label_zh,
  category,
  description,
  notes,
  default_required,
  sort_order,
  is_active
) VALUES (
  'military_service_record',
  '兵役證明',
  'visa_enrollment',
  '用於證明學生兵役狀態，部分國家簽證申請或學校入學程序需要提供。',
  '請至戶政事務所或區公所申請「兵役狀況證明書」（英文版）。役畢者請附退伍令影本；免役者請附免役證明；在學緩徵者請附緩徵證明。所有文件需為彩色掃描或照片。',
  false,
  150,
  true
);
```

> `default_required = false`：非預設勾選，由顧問視需要手動勾選。
> `sort_order = 150`：排在現有簽證/入學文件（sort 110–140）之後。
> `category = 'visa_enrollment'`：歸屬於簽證/入學文件分類。

### 3.2 Migration 檔案
建立 `supabase/migrations/YYYYMMDDHHMMSS_add_military_service_document.sql`

**需手動到 Supabase Dashboard 執行**：
- `..._add_military_service_document.sql`

**驗收**：
- [ ] 申請準備檔案清單出現「兵役證明」
- [ ] 預設為未勾選
- [ ] 分類為「簽證/入學文件」，排在最後
- [ ] hover 注意事項顯示正確內容
- [ ] 完成後 commit：`feat: [3] 新增兵役證明文件範本`

---

## 4. 選校表：搜尋學校功能修復

**位置**：選校表頁面的「新增學校」下拉搜尋元件（`app/(dashboard)/students/[id]/schools/`）

**問題**：輸入中文或英文字母後，下拉選單沒有依輸入內容縮小範圍（搜尋無作用）。

**修改內容**：

### 4.1 診斷方向
Claude Code 請先確認目前搜尋的實作方式屬於以下哪種，再對應修復：

**情況 A：前端 filter（已有完整資料，client-side 過濾）**
```tsx
// 問題通常是：filter 條件寫錯，或沒有 normalize 字串
// 修正方式：
const filtered = schools.filter(s =>
  s.name_zh?.includes(query) ||
  s.name_en?.toLowerCase().includes(query.toLowerCase())
)
```

**情況 B：後端搜尋（每次輸入打 API）**
```tsx
// 問題通常是：debounce 沒有正確觸發，或 query param 沒傳到
// 修正方式：確認 useDebounce hook 正常，確認 supabase query 使用 .ilike()
const { data } = await supabase
  .from('schools')
  .select('*')
  .or(`name_zh.ilike.%${query}%,name_en.ilike.%${query}%`)
  .limit(20)
```

### 4.2 通用修復要點
無論哪種情況，確保：
1. 中文搜尋：`includes(query)`（不需 toLowerCase，中文本來就 case-insensitive）
2. 英文搜尋：`toLowerCase()` 雙邊 normalize
3. 搜尋欄位包含：`name_zh`（中文校名）+ `name_en`（英文校名）+ `abbreviation`（縮寫，如有）
4. 輸入為空時顯示全部（或顯示熱門/最近加入的幾筆）
5. debounce：若為後端搜尋，加 `300ms` debounce 避免每個字母都打 API

**驗收**：
- [ ] 輸入中文字（如「哈佛」）下拉選單縮小至包含此字的學校
- [ ] 輸入英文字母（如「Har」）縮小至包含此字串的學校（不區分大小寫）
- [ ] 清空搜尋欄位後恢復顯示
- [ ] 完成後 commit：`fix: [4] 選校表搜尋學校功能修復`

---

## 5. 申請學校面板：「放棄錄取」「確定入學」狀態不隱藏已上傳文件

**位置**：申請頁面，每一所學校的展開面板（`app/(dashboard)/students/[id]/applications/[appId]/`）

**問題**：狀態切換為「放棄錄取」或「確定入學」時，已上傳的 PDF 文件（錄取通知書、拒絕信等）被隱藏。

**修改內容**：
1. 找到控制上傳文件區顯示/隱藏的條件，目前推測類似：
   ```tsx
   // 錯誤的條件（推測）
   {status === 'admitted' && <OfferUploadSection />}
   ```
2. 修改為：**有已上傳檔案時永遠顯示；無檔案時只在特定狀態顯示上傳按鈕**
   ```tsx
   // 修正後邏輯
   const showOfferSection =
     application.offer_letter_path ||           // 已有檔案 → 永遠顯示
     status === 'admitted';                      // 狀態為錄取 → 顯示上傳按鈕

   const showRejectionSection =
     application.rejection_letter_path ||        // 已有檔案 → 永遠顯示
     status === 'rejected';                      // 狀態為拒絕 → 顯示上傳按鈕

   {showOfferSection && (
     <DocumentSection
       label="錄取通知書"
       filePath={application.offer_letter_path}
       showUpload={status === 'admitted' || status === 'enrolled' || status === 'offer_declined'}
     />
   )}
   ```
3. 「放棄錄取」「確定入學」狀態下：
   - 已上傳的文件：顯示「查看 PDF」按鈕（不隱藏）
   - 上傳按鈕：改為「重新上傳」（允許替換文件）

**驗收**：
- [ ] 狀態為「放棄錄取」時，已上傳的錄取通知書仍然可見
- [ ] 狀態為「確定入學」時，已上傳的文件仍然可見
- [ ] 兩種狀態下可點「重新上傳」替換文件
- [ ] 無已上傳檔案 + 非相關狀態時，文件區不顯示（維持現有行為）
- [ ] 完成後 commit：`fix: [5] 申請面板狀態切換不隱藏已上傳文件`

---

## 需手動到 Supabase Dashboard 執行的 migration 清單

1. `..._add_military_service_document.sql`（第 3 項）

---

## 驗收清單（全部完成後）

- [ ] Sidebar：白底 + 右側陰影 + 主畫面 `#F9FAFC`，收合/展開正常，localStorage 記憶
- [ ] Checklist：每列顯示 勾選 → 狀態燈 → 狀態文字 → 文件名稱
- [ ] Checklist：「兵役證明」出現，預設未勾選，分類/說明正確
- [ ] 選校表：中英文搜尋正常縮小範圍
- [ ] 申請面板：放棄錄取/確定入學狀態不隱藏已上傳文件
- [ ] 所有修改均有獨立 commit
- [ ] Migration 清單產出
