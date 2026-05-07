# CRM 重複名單防治規格 v1.0

> **目的**：防止 CRM 系統內出現重複學生名單，保護業務資源與資料品質。
> **執行原則**：同前（每項獨立 commit、schema 變更寫 migration、不確定自行判斷）
> **前置確認**：先 `git pull` 確認在最新 commit 後再開始。
> **測試資料**：目前 DB 有 7 筆假名單，手機號碼皆不重複，可直接用於測試。

---

## 架構總覽

| 層級 | 機制 | 實作方式 |
|---|---|---|
| DB 層 | `students.phone` 加 UNIQUE constraint | Migration |
| 偵測層 | 建檔時比對手機號碼 | Server Action |
| 提示層 | 顧問看到 inline 警示 + 主管收到通知 | UI + activity_log |
| 關係人層 | 表單新增填寫人身份 + 後台可補填 | Form + 新表 |

---

## 1. DB 層：手機號碼唯一約束

**位置**：`supabase/migrations/`

**修改內容**：

```sql
-- Step 1：清查目前是否有重複手機號碼（執行後人工確認無問題再跑 Step 2）
SELECT phone, COUNT(*) as cnt
FROM students
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- Step 2：加 UNIQUE constraint
ALTER TABLE students
  ADD CONSTRAINT students_phone_unique UNIQUE (phone);

-- Step 3：phone 允許 NULL（尚未填手機的名單不受影響）
-- UNIQUE constraint 在 PostgreSQL 預設允許多個 NULL，不需額外處理
```

> ⚠️ **必須先跑 Step 1 確認無重複，才能跑 Step 2。**
> 若 Step 1 有結果，需先人工處理重複資料再加約束。

**Migration 檔案**：
`supabase/migrations/YYYYMMDDHHMMSS_add_phone_unique_constraint.sql`

**需手動到 Supabase Dashboard 執行**：
- 先執行 Step 1（SELECT）確認結果為空
- 確認後執行 Step 2（ALTER TABLE）

**驗收**：
- [ ] `students.phone` 有 UNIQUE constraint
- [ ] NULL 值不受影響（允許多筆 phone = NULL）
- [ ] 嘗試插入重複手機號碼時，DB 層直接擋住並回傳錯誤
- [ ] commit：`feat: [1] students.phone 加 UNIQUE constraint`

---

## 2. 偵測層：建檔時比對手機號碼

### 2A. 內部顧問建立名單（CRM 內部）

**位置**：`app/(dashboard)/students/new/page.tsx` + `app/(dashboard)/students/new/actions.ts`

**修改內容**：

#### 2A.1 前端即時比對（輸入手機後觸發）
```tsx
// 在手機號碼欄位加 onBlur 事件
const checkDuplicate = async (phone: string) => {
  if (!phone || phone.length < 8) return
  const result = await checkPhoneDuplicate(phone)  // Server Action
  if (result.isDuplicate) {
    setDuplicateWarning(result.existingStudent)
  }
}

<Input
  id="phone"
  onBlur={(e) => checkDuplicate(e.target.value)}
/>
```

#### 2A.2 Server Action：查詢手機是否已存在
```ts
// app/(dashboard)/students/new/actions.ts
export async function checkPhoneDuplicate(phone: string) {
  // 正規化手機號碼（移除空格、破折號）
  const normalized = phone.replace(/[\s\-]/g, '')

  const { data } = await supabase
    .from('students')
    .select('id, name, phone, created_at, frontend_advisor:profiles(name)')
    .eq('phone', normalized)
    .single()

  return {
    isDuplicate: !!data,
    existingStudent: data ?? null,
  }
}
```

#### 2A.3 提示 UI（inline warning）
當 `isDuplicate = true` 時，在手機欄位下方顯示警示區塊：

```tsx
{duplicateWarning && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-1">
    <div className="flex items-start gap-2">
      <AlertTriangle className="text-amber-500 mt-0.5" size={15} />
      <div>
        <p className="text-sm font-semibold text-amber-800">
          系統找到一筆相同手機號碼的學生
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          姓名：{duplicateWarning.name}　
          負責顧問：{duplicateWarning.frontend_advisor?.name ?? '未指派'}　
          建立時間：{formatDate(duplicateWarning.created_at)}
        </p>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/students/${duplicateWarning.id}`)}
          >
            查看現有名單 →
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700"
            onClick={() => setIgnoreDuplicate(true)}
          >
            確認為不同學生，繼續建立
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### 2A.4 建檔時的最終保護
```ts
// 送出表單時，若有重複且顧問未點「確認繼續」，阻止送出
if (duplicateWarning && !ignoreDuplicate) {
  toast.error('請先確認重複名單的處理方式')
  return
}
```

#### 2A.5 主管通知
當顧問點「確認為不同學生，繼續建立」後：
```ts
// 寫入 activity_log，讓主管可追蹤
await supabase.from('activity_log').insert({
  event_type: 'duplicate_phone_override',
  student_id: newStudentId,
  actor_id: currentUserId,
  metadata: {
    duplicate_of_student_id: duplicateWarning.id,
    phone: normalizedPhone,
    reason: 'confirmed_different_by_consultant',
  }
})

// 同時寄送通知給前端主管（寫入 notifications 表或 activity_log 特殊 flag）
await notifyManagers({
  type: 'duplicate_phone_override',
  message: `${consultantName} 建立了與現有名單手機號碼相同的新學生（${studentName}），請確認。`,
  link: `/students/${newStudentId}`,
})
```

**驗收**：
- [ ] 輸入已存在的手機號碼，失焦後出現 amber 警示區塊
- [ ] 警示顯示：現有學生姓名、負責顧問、建立時間
- [ ] 點「查看現有名單」正確導向
- [ ] 點「確認為不同學生」後可繼續建立
- [ ] 若未確認直接送出，表單阻止並 toast 提示
- [ ] 強制繼續建立時寫入 `activity_log`（event: `duplicate_phone_override`）
- [ ] 主管收到通知
- [ ] commit：`feat: [2A] 內部建名單手機重複偵測`

---

### 2B. 轉介人 Portal 表單（對外）

> ⚠️ **注意**：轉介人 Portal 目前只有 DEMO（`docs/specs/referral-portal-v2.html`），尚未正式開發。
> 本節規格為**正式版 Portal 開發時的需求**，現在不實作，留存備用。

**正式版開發時需包含**：
1. 轉介人填寫手機號碼後，即時打 API 比對
2. 若手機已存在，顯示提示：「系統顯示此學生已有諮詢紀錄，我們的顧問將主動與您聯繫確認。」
3. 不顯示現有學生的詳細資料（保護隱私，轉介人不能看到 CRM 內資料）
4. 後台同樣寫 `activity_log` 並通知主管

---

## 3. 關係人（家長）設計

### 3A. 新增 `student_contacts` 表

**Migration 檔案**：`supabase/migrations/YYYYMMDDHHMMSS_create_student_contacts.sql`

```sql
CREATE TABLE student_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('父親', '母親', '監護人', '親戚', '其他')),
  name text NOT NULL,
  phone text,
  email text,
  line_id text,
  is_primary_contact boolean NOT NULL DEFAULT false,  -- 主要聯絡人（可能是家長而非學生）
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON student_contacts(student_id);

-- 同一學生的 phone 不強制 UNIQUE（同家庭可能共用號碼）
```

**需手動到 Supabase Dashboard 執行**：
- `..._create_student_contacts.sql`

### 3B. 新增學生表單：填寫人身份選擇

**位置**：`app/(dashboard)/students/new/page.tsx`

在表單頂部新增：

```tsx
<div className="form-section-label">填寫人身份</div>
<div className="flex gap-3 mb-4">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="radio"
      name="filler-type"
      value="self"
      checked={fillerType === 'self'}
      onChange={() => setFillerType('self')}
    />
    <span className="text-sm">本人填寫</span>
  </label>
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="radio"
      name="filler-type"
      value="parent"
      checked={fillerType === 'parent'}
      onChange={() => setFillerType('parent')}
    />
    <span className="text-sm">家長 / 關係人代填</span>
  </label>
</div>

{/* 選擇「家長代填」後展開關係人欄位 */}
{fillerType === 'parent' && (
  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-4">
    <div class="form-section-label">代填人資料</div>
    <div className="form-grid">
      <div className="fg">
        <label>與學生關係<span className="req">*</span></label>
        <Select name="contact-relation">
          <option>父親</option>
          <option>母親</option>
          <option>監護人</option>
          <option>親戚</option>
          <option>其他</option>
        </Select>
      </div>
      <div className="fg">
        <label>代填人姓名<span className="req">*</span></label>
        <Input placeholder="家長姓名" name="contact-name" />
      </div>
      <div className="fg">
        <label>代填人手機</label>
        <Input placeholder="家長手機號碼" name="contact-phone" />
      </div>
      <div className="fg">
        <label>代填人 Email</label>
        <Input placeholder="家長 Email" name="contact-email" />
      </div>
    </div>
    <p className="text-xs text-blue-600 mt-2">
      💡 代填人資料將附掛在學生檔案下，不會建立新的學生名單。
    </p>
  </div>
)}
```

送出時：
1. 建立 `students` 主記錄（正常流程）
2. 若 `fillerType === 'parent'`，同時建立一筆 `student_contacts` 記錄（`is_primary_contact = true`）

### 3C. 後台補填關係人（學生 360° 主頁）

**位置**：`app/(dashboard)/students/[id]/page.tsx`

在學生主頁「基本資料」區塊新增「關係人」子區塊：

```
┌─────────────────────────────────┐
│ 關係人                    ＋ 新增 │
├─────────────────────────────────┤
│ 王媽媽 · 母親                    │
│ 📱 0912-345-678                 │
│ ✉️ mom@example.com              │
│ 主要聯絡人 ✓                     │
└─────────────────────────────────┘
```

功能：
- 新增 / 編輯 / 刪除關係人
- 可標記「主要聯絡人」（顧問聯繫優先打這支電話）
- 寫 `activity_log`：`contact_added` / `contact_updated`

**驗收**：
- [ ] `student_contacts` 表建立完成
- [ ] 新增學生表單有「填寫人身份」選項
- [ ] 選「家長代填」後展開代填人欄位
- [ ] 送出後代填人資料寫入 `student_contacts`
- [ ] 學生主頁可查看 / 新增 / 編輯 / 刪除關係人
- [ ] 關係人操作寫入 `activity_log`
- [ ] commit：`feat: [3] 關係人（家長）設計`

---

## 4. 主管管控介面：疑似重複通知

**位置**：`app/(dashboard)/settings/` 或 `app/(dashboard)/students/`（視既有結構）

**修改內容**：

### 4A. 通知機制（連動第 2 節）

當 `activity_log` 出現 `event_type = 'duplicate_phone_override'` 時：
1. 在主管的 Dashboard widget 新增一個警示：
   ```
   ⚠️ 有 X 筆名單覆蓋了重複手機號碼，請確認
   ```
2. 點擊進入清單，顯示所有 `duplicate_phone_override` 紀錄
3. 主管可標記「已確認無問題」或「需要合併」

### 4B. 主管操作：標記與合併

**合併邏輯**（保守設計，不自動執行）：
- 主管點「確認需要合併」後，系統**不自動合併**
- 改為：開啟一個確認彈窗，列出兩筆學生的詳細資料
- 主管選擇「保留哪一筆為主檔」後，系統執行：
  1. 把新建的學生資料（姓名/手機/成績等）合併到主檔
  2. 把新建的 `activity_log` / `deals` / `applications` 等關聯資料 re-point 到主檔
  3. 軟刪除新建的重複學生（`is_deleted = true`，不硬刪）
  4. 寫 `activity_log`：`duplicate_merged_by_manager`

> **ASSUMPTION**：合併功能複雜度高，MVP 版本先做「通知 + 提示」，合併操作由主管手動處理（直接編輯保留的那筆資料）。「一鍵合併」列為後續版本。

**驗收**：
- [ ] 顧問強制建立重複手機名單後，主管 Dashboard 出現警示 widget
- [ ] 主管可查看所有 override 紀錄（含顧問姓名、時間、兩筆學生連結）
- [ ] 主管可標記「已確認」，警示消失
- [ ] commit：`feat: [4] 主管重複名單通知介面`

---

## 5. 全站防護：DB 層最終攔截

即使前端沒有觸發任何提示（例如直接 API 呼叫、或前端 bug），DB 層的 UNIQUE constraint 會作為最後一道防線：

```ts
// 在所有建立學生的 Server Action 中，統一處理 DB UNIQUE 錯誤
try {
  const { data, error } = await supabase.from('students').insert({ ... })
  if (error?.code === '23505') {  // PostgreSQL unique_violation
    return {
      success: false,
      error: 'DUPLICATE_PHONE',
      message: '此手機號碼已有學生名單存在，請先搜尋現有名單。'
    }
  }
} catch (err) {
  // ...
}
```

前端收到 `DUPLICATE_PHONE` 錯誤時，顯示明確的錯誤提示（不是通用的 500 錯誤）。

**驗收**：
- [ ] 所有建立學生的 Server Action 有處理 `23505` 錯誤碼
- [ ] 前端顯示友善的重複提示訊息（非通用錯誤）
- [ ] commit：`feat: [5] DB 層 UNIQUE violation 友善錯誤處理`

---

## 執行順序建議

1. **第 1 項**（DB UNIQUE constraint）— 最優先，這是地基
2. **第 5 項**（Server Action 錯誤處理）— 搭配第 1 項一起做
3. **第 2A 項**（內部建名單即時比對）— 核心 UX 保護
4. **第 3 項**（關係人設計）— 解決已知痛點
5. **第 4 項**（主管通知介面）— 管控層
6. **第 2B 項**（轉介人 Portal）— 等正式版 Portal 開發時再做

---

## 需手動到 Supabase Dashboard 執行的 Migration 清單

1. `..._add_phone_unique_constraint.sql`
   - ⚠️ 執行前先跑 Step 1（SELECT 確認無重複）
2. `..._create_student_contacts.sql`

---

## 驗收清單（全部完成後）

- [ ] `students.phone` 有 UNIQUE constraint，NULL 不受影響
- [ ] 內部建名單：輸入重複手機後出現 amber 警示，顯示現有學生資訊
- [ ] 顧問可選「查看現有名單」或「確認繼續建立」
- [ ] 強制繼續時寫 `activity_log`（`duplicate_phone_override`）
- [ ] 主管 Dashboard 出現警示 widget
- [ ] 新增學生表單有填寫人身份選擇
- [ ] 選家長代填後展開代填人欄位，資料寫入 `student_contacts`
- [ ] 學生主頁可管理關係人
- [ ] DB 層 UNIQUE violation 有友善錯誤訊息
- [ ] 所有修改均有獨立 commit
- [ ] Migration 清單產出
