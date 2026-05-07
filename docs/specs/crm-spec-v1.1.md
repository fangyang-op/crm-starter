# CRM 系統修改規格 v1.1

> **目的**：接續 v1.0 執行完的成果，本輪為 6 項功能與 UI 修改。
> **執行原則**：同 v1.0（每項獨立 commit、schema 變更寫 migration、不確定自行判斷）
> **前置確認**：先 `git pull` 確認在最新 commit（c34566f）後再開始。

---

## 1. 建立成交：自動帶入轉介人

**位置**：`app/(dashboard)/students/[id]/deal/new/page.tsx`（或既有的成交建立表單）

**問題**：建立名單時若已填寫轉介人，建立成交時「績效拆分 / 轉介人」欄位需要手動再填一次。

**修改內容**：
1. 進入建立成交頁面時，Server Component 查詢該學生的 `students.referrer_id`（或 `lead_source_referrers` 關聯）
2. 若有值，自動帶入成交表單的「轉介人」欄位，且欄位狀態為 **pre-filled**（可修改，但有視覺提示說明是自動帶入）：
   ```tsx
   // 欄位下方加 hint
   <p className="text-xs text-muted-foreground">
     ✦ 已根據名單來源自動帶入，如需更改請手動調整
   </p>
   ```
3. 若學生無轉介人，欄位保持空白（現有行為不變）
4. 自動帶入的欄位同時帶入「拆分比例」預設值（來自 `referrers.default_split_percent`）

**驗收**：
- [ ] 有轉介人的學生進入建立成交頁，轉介人欄位自動帶入且有 hint 文字
- [ ] 無轉介人的學生，欄位維持空白
- [ ] 帶入的拆分比例與 `referrers.default_split_percent` 一致
- [ ] 可手動覆蓋

---

## 2. 學生名單「當前學歷」選項更新

**位置**：
- `app/(dashboard)/students/new/page.tsx`（新增學生表單）
- `app/(dashboard)/students/[id]/edit/page.tsx`（編輯學生表單）
- DB：`students.current_education` 欄位的 check constraint 或 enum

**修改內容**：
1. 將「當前學歷」選項從原本的學士/碩士等，改為以下 **13 個固定選項**（順序固定）：
   ```
   國一、國二、國三、高一、高二、高三、
   大一、大二、大三、大四、大五、
   在台碩士、在職人士
   ```
2. DB migration：
   ```sql
   -- 若為 enum type，需重建；若為 text + check constraint，更新 constraint
   -- ASSUMPTION: 使用 text + check constraint

   ALTER TABLE students
     DROP CONSTRAINT IF EXISTS students_current_education_check;

   ALTER TABLE students
     ADD CONSTRAINT students_current_education_check
     CHECK (current_education IN (
       '國一','國二','國三',
       '高一','高二','高三',
       '大一','大二','大三','大四','大五',
       '在台碩士','在職人士'
     ));
   ```
3. 既有資料對應：
   ```sql
   -- 把舊值遷移到最接近的新值（ASSUMPTION）
   UPDATE students SET current_education = '大四'  WHERE current_education IN ('學士','大學');
   UPDATE students SET current_education = '在台碩士' WHERE current_education = '碩士';
   UPDATE students SET current_education = '在職人士' WHERE current_education IN ('博士','其他');
   -- 其餘無法對應的設為 NULL（讓顧問手動補填）
   UPDATE students SET current_education = NULL
     WHERE current_education NOT IN (
       '國一','國二','國三','高一','高二','高三',
       '大一','大二','大三','大四','大五','在台碩士','在職人士'
     );
   ```
4. 前端 `<Select>` options 依上方 13 個順序更新

**需手動到 Supabase Dashboard 執行的 migration**：
- `supabase/migrations/YYYYMMDDHHMMSS_update_education_options.sql`

**驗收**：
- [ ] 新增/編輯學生時，學歷下拉共 13 個選項、順序正確
- [ ] 既有資料無欄位值報錯
- [ ] DB constraint 更新完成

---

## 3. 待分配後端顧問：Dashboard widget + 學生列表篩選 tab

### 3A. Dashboard 首頁 widget（C 方案）

**位置**：`app/(dashboard)/page.tsx`（Dashboard 首頁）

**修改內容**：
1. 新增一個 **警示 widget**，條件：`students` 表中 `status` 屬於「已成交」類別（`deal_created` 或 `is_dealt = true`），且 `backend_advisor_id IS NULL`
2. Widget 樣式：
   ```
   💡 目前尚有 X 位學生尚未分配後端顧問
   ```
   - 背景：淡黃色（amber-light）
   - 右側有「查看清單 →」按鈕，點擊導向學生列表並自動套用「待分配後端」篩選
   - X 為即時查詢數字
3. 若 X = 0，widget **不顯示**（自動隱藏）

**驗收**：
- [ ] Dashboard 出現 widget，數字正確
- [ ] X = 0 時不顯示
- [ ] 點擊「查看清單」導向正確篩選

---

### 3B. 學生列表新增「待分配後端」篩選 tab（B 方案）

**位置**：`app/(dashboard)/students/page.tsx`（學生列表）

**修改內容**：
1. 在現有的篩選 tabs（全部 / 招生中 / 申請中 / …）新增一個 **「待分配後端」tab**
2. 此 tab 的查詢條件：
   ```sql
   SELECT * FROM students
   WHERE backend_advisor_id IS NULL
     AND status_id IN (
       SELECT id FROM student_statuses WHERE category = 'application'
       -- 或直接：已成交之後的狀態
     )
   ORDER BY deal_created_at ASC  -- 越早成交的排越前面
   ```
3. Tab 旁顯示數字 badge（同 Dashboard widget 的數字）
4. 欄位顯示：在此 tab 下，表格額外顯示「成交日期」欄位，方便主管看出等待多久

**ASSUMPTION**：`students` 表有 `backend_advisor_id uuid NULL references profiles(id)` 欄位。若無，新增 migration：
```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS backend_advisor_id uuid REFERENCES profiles(id);
```

**需手動到 Supabase Dashboard 執行的 migration**：
- `supabase/migrations/YYYYMMDDHHMMSS_add_backend_advisor_id.sql`

**驗收**：
- [ ] 學生列表出現「待分配後端」tab
- [ ] 數字 badge 與 Dashboard widget 一致
- [ ] 點擊 tab 只顯示符合條件的學生
- [ ] 欄位包含「成交日期」

---

## 4. 申請準備檔案：上傳後留在 Panel 不跳離

**位置**：`app/(dashboard)/students/[id]/checklist/` 或申請準備 Checklist 元件

**問題**：上傳完一份文件後，Panel 關閉或頁面跳走，需要點開 13 次才能逐一上傳。

**修改內容**：
1. 上傳成功後 **不關閉 Panel / Dialog**，改為：
   - 該列狀態即時更新為「已上傳」（樂觀更新）
   - 顯示一個短暫的 inline success toast（綠色，1.5 秒消失）在該列右側：「✓ 上傳成功」
   - Panel 維持開啟，游標自動移到下一個「待上傳」項目（scroll into view）
2. 若現在的實作是 `<Dialog>` 在上傳後 `onSuccess` 呼叫 `setOpen(false)`，移除該呼叫

**驗收**：
- [ ] 上傳成功後 Panel 不關閉
- [ ] 該列狀態即時更新
- [ ] Inline success 提示出現後消失
- [ ] 自動捲動到下一個待上傳項目

---

## 5. 申請準備檔案：狀態燈移到標題左側

**位置**：Checklist 列表每一行的 layout

**問題**：目前順序為「勾選 → 標題 → 狀態燈」

**修改內容**：
改為：**勾選 → 狀態燈 → 標題**（從左至右）

```tsx
// 修改前（示意）
<div className="flex items-center gap-3">
  <Checkbox />
  <span>{doc.label_zh}</span>
  <StatusDot status={doc.status} />
</div>

// 修改後
<div className="flex items-center gap-3">
  <Checkbox />
  <StatusDot status={doc.status} />
  <span>{doc.label_zh}</span>
</div>
```

狀態燈規格（若未統一，趁此統一）：
```
pending  → 灰色實心圓點
uploaded → 藍色實心圓點
verified → 綠色實心圓點
rejected → 紅色實心圓點
```
圓點大小：`w-2 h-2`（8px），垂直置中對齊文字。

**驗收**：
- [ ] 每列順序：勾選框 → 狀態燈 → 文件名稱
- [ ] 四種狀態顏色正確

---

## 6. 檔案上傳按鈕 UI 統一（全站）

**目標樣式**（依截圖）：
```
┌─────────────────────────────────────────────┐
│  ↑  選擇檔案（PNG / JPEG / WebP / PDF，最大 10MB）│  ← 虛線框、置中文字、上傳 icon
└─────────────────────────────────────────────┘
```

**樣式規格**：
- 外框：虛線邊框（`border-dashed`）、圓角、`border-muted-foreground/40`
- 背景：透明或極淡（`bg-muted/30`）
- 內容置中：上傳 icon（lucide `Upload`）+ 文字
- hover 時：邊框變品牌色（`#C7315C`）、背景略深
- 文字格式：`選擇檔案（{允許格式}，最大 {size}MB）`

**建立共用元件**：`components/ui/file-upload-button.tsx`

```tsx
interface FileUploadButtonProps {
  accept: string          // e.g. "application/pdf"
  maxMB?: number          // default 10
  label?: string          // 若需自訂說明文字
  onChange: (file: File) => void
  disabled?: boolean
}
```

**套用範圍**（全站所有 `<input type="file">` 替換）：
- 成績編輯頁：證書上傳
- Defer 同意書上傳
- 申請頁：錄取/拒絕信上傳
- 申請頁：獎學金通知信上傳
- 申請準備 Checklist：每筆文件上傳
- 任何其他 `<input type="file">` 的地方（grep 後全換）

**上傳格式限制與邏輯不變**（只改視覺，`accept` 屬性維持原值）。

**驗收**：
- [ ] `FileUploadButton` 元件建立完成
- [ ] hover 效果正確（邊框變品牌色）
- [ ] 全站 `<input type="file">` 替換完成
- [ ] 各頁面格式限制維持原本設定不變

---

## 需手動到 Supabase Dashboard 執行的 migration 清單

Claude Code 完成後請列出實際產生的 migration 檔名，預期會包含：

1. `..._update_education_options.sql` — 更新學歷選項 + 資料遷移
2. `..._add_backend_advisor_id.sql` — 新增 `students.backend_advisor_id` 欄位（若不存在）

---

## 明天驗收清單（預期）

- [ ] 建立成交：有轉介人的學生自動帶入轉介人 + 拆分比例
- [ ] 學歷選項：共 13 個，順序正確
- [ ] Dashboard：💡 widget 顯示待分配人數，0 人時隱藏
- [ ] 學生列表：「待分配後端」tab + badge 數字
- [ ] 申請準備 Checklist：上傳後不跳離，inline 成功提示
- [ ] Checklist 列順序：勾選 → 狀態燈 → 標題
- [ ] 全站檔案上傳按鈕：虛線框設計，hover 變品牌色
- [ ] 所有修改均有獨立 commit
- [ ] Migration 檔清單產出
