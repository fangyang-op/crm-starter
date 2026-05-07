# CRM 修改規格 — 手機正規化 + 代填 Bug 修正

> **接續**：重複名單防治功能驗收中發現的問題
> **執行原則**：同前（每項獨立 commit、不確定自行判斷）

---

## 1. 手機號碼正規化（全站統一）

### 1.1 正規化規則

台灣所有手機與市話格式，寫入 DB 前統一轉成純數字字串（`09xxxxxxxx` 或 `0x-xxxxxxxx`）。

**轉換邏輯**：
1. 去除所有空格、破折號、括號
2. 若開頭為 `+8869`，替換為 `09`
3. 若開頭為 `+886`（後接非 9），替換為 `0`
4. 結果只保留數字

**完整對照表**：

| 輸入格式 | 正規化結果 |
|---|---|
| `0912345678` | `0912345678` |
| `0912-345678` | `0912345678` |
| `0912-345-678` | `0912345678` |
| `0912 345 678` | `0912345678` |
| `+886912345678` | `0912345678` |
| `+8869-12345678` | `0912345678` |
| `+8869-12-345-678` | `0912345678` |
| `0255802586` | `0255802586` |
| `02 5580 2586` | `0255802586` |
| `02 5580-2586` | `0255802586` |
| `02-55802586` | `0255802586` |
| `02-5580-2586` | `0255802586` |
| `(02)55802586` | `0255802586` |
| `(02)5580-2586` | `0255802586` |

### 1.2 建立共用工具函式

**位置**：`lib/utils/phone.ts`（新增檔案）

```ts
/**
 * 正規化台灣手機 / 市話號碼
 * 去除空格、破折號、括號；+886 開頭轉 0 開頭
 * 回傳純數字字串，若輸入為空回傳空字串
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''

  let phone = raw.trim()

  // +8869xxxxxxxx → 09xxxxxxxx
  phone = phone.replace(/^\+8869/, '09')

  // +886x → 0x（市話等）
  phone = phone.replace(/^\+886/, '0')

  // 去除所有非數字字元（空格、破折號、括號等）
  phone = phone.replace(/\D/g, '')

  return phone
}

/**
 * 驗證是否為合法台灣電話號碼（正規化後）
 * 手機：09 開頭，共 10 碼
 * 市話：0[2-9] 開頭，共 9-10 碼
 */
export function isValidTaiwanPhone(normalized: string): boolean {
  return /^09\d{8}$/.test(normalized) ||        // 手機
         /^0[2-9]\d{7,8}$/.test(normalized)      // 市話
}
```

### 1.3 套用正規化的位置（全站）

**以下所有地方，在寫入 DB 前都要呼叫 `normalizePhone()`**：

1. **`app/(dashboard)/students/new/actions.ts`** — 建立學生
2. **`app/(dashboard)/students/[id]/edit/actions.ts`** — 編輯學生
3. **`app/(dashboard)/students/[id]/contacts/actions.ts`** — 新增/編輯關係人
4. **`lib/duplicate-check.ts`（或 actions 內的 `checkPhoneDuplicate`）** — 比對前正規化

```ts
// 套用範例（建立學生）
import { normalizePhone } from '@/lib/utils/phone'

const normalizedPhone = normalizePhone(formData.phone)

const { data, error } = await supabase
  .from('students')
  .insert({
    ...otherFields,
    phone: normalizedPhone || null,  // 空字串存為 null
  })
```

### 1.4 即時比對也要正規化

```ts
// checkPhoneDuplicate 內
export async function checkPhoneDuplicate(rawPhone: string) {
  const normalized = normalizePhone(rawPhone)
  if (!normalized) return { isDuplicate: false, existingStudent: null }

  const { data } = await supabase
    .from('students')
    .select('id, name_zh, phone, created_at, frontend_advisor:profiles(full_name)')
    .eq('phone', normalized)
    .maybeSingle()

  return {
    isDuplicate: !!data,
    existingStudent: data ?? null,
  }
}
```

> **ASSUMPTION**：現有資料庫裡的 7 筆假名單，電話格式是否已經是純數字？若否，Claude Code 請先執行一次資料遷移把既有 phone 欄位全部正規化，再繼續。

### 1.5 資料遷移（既有資料）

**Migration 檔案**：`supabase/migrations/YYYYMMDDHHMMSS_normalize_existing_phones.sql`

```sql
-- 正規化既有 students.phone
UPDATE students
SET phone = regexp_replace(
  regexp_replace(
    regexp_replace(phone, '^\+8869', '09'),
    '^\+886', '0'
  ),
  '[^0-9]', '', 'g'
)
WHERE phone IS NOT NULL
  AND phone != regexp_replace(
    regexp_replace(
      regexp_replace(phone, '^\+8869', '09'),
      '^\+886', '0'
    ),
    '[^0-9]', '', 'g'
  );

-- 同樣處理 student_contacts.phone
UPDATE student_contacts
SET phone = regexp_replace(
  regexp_replace(
    regexp_replace(phone, '^\+8869', '09'),
    '^\+886', '0'
  ),
  '[^0-9]', '', 'g'
)
WHERE phone IS NOT NULL
  AND phone != regexp_replace(
    regexp_replace(
      regexp_replace(phone, '^\+8869', '09'),
      '^\+886', '0'
    ),
    '[^0-9]', '', 'g'
  );
```

**需手動到 Supabase Dashboard 執行**：
- `..._normalize_existing_phones.sql`

**驗收**：
- [ ] `lib/utils/phone.ts` 建立，`normalizePhone()` 函式存在
- [ ] 建立學生、編輯學生、新增關係人，寫入前都呼叫 `normalizePhone()`
- [ ] `checkPhoneDuplicate` 比對前正規化
- [ ] 輸入 `0912-345-678` 和 `0912345678` 都能觸發同一筆的重複偵測
- [ ] 輸入 `+886912345678` 也能觸發重複偵測
- [ ] 既有資料遷移 migration 產出
- [ ] commit：`feat: [1] 手機號碼正規化，統一寫入與比對格式`

---

## 2. 修正：代填人身份 `actions.ts` export 錯誤

**錯誤訊息**：
```
Error: A "use server" file can only export async functions, found object.
```

**位置**：`app/(dashboard)/students/[id]/contacts/actions.ts`

**問題**：`"use server"` 檔案裡 export 了非 async function 的 object（可能是 export const 物件、型別 export 或其他非 function 的東西）。

**修正方式**：
1. 找出所有非 async function 的 export，移除或改寫
2. 型別 / interface export 改移到獨立的 `types.ts` 檔案
3. `"use server"` 檔案只保留 async function export

```ts
// ❌ 錯誤：export 了 object
"use server"
export const CONTACT_RELATIONS = ['父親', '母親', '監護人', '親戚', '其他']

// ✅ 正確：移到 types.ts 或 constants.ts
// contacts/constants.ts（不加 "use server"）
export const CONTACT_RELATIONS = ['父親', '母親', '監護人', '親戚', '其他']
```

**驗收**：
- [ ] `/students/new` 頁面不再出現 Runtime Error
- [ ] `actions.ts` 只剩 async function export
- [ ] commit：`fix: [2] contacts actions.ts 移除非 async function export`

---

## 3. 修正：代填人手機未走重複偵測

**位置**：`app/(dashboard)/students/new/page.tsx`（代填人手機欄位）

**問題**：「家長代填」展開後，代填人的手機欄位沒有觸發 `checkPhoneDuplicate`。

**修正方式**：
代填人手機欄位同樣加 `onBlur` 觸發比對，邏輯與學生本人手機相同：

```tsx
// 代填人手機欄位
<Input
  placeholder="家長手機號碼"
  name="contact-phone"
  onBlur={(e) => {
    if (e.target.value) checkDuplicate(e.target.value)
  }}
/>
```

> **注意**：代填人手機重複時，提示文字要稍作調整，說明「此手機號碼已登記在另一位學生的聯絡資訊中」，而不是「此手機號碼已有學生名單存在」（語意不同）。

**兩種重複情況的提示文字**：

| 情況 | 比對目標 | 提示文字 |
|---|---|---|
| 學生本人手機重複 | `students.phone` | 「系統找到一筆相同手機號碼的學生，請確認是否為同一人」 |
| 代填人手機重複 | `students.phone` + `student_contacts.phone` | 「此手機號碼已登記在現有學生或其關係人資料中，請確認」 |

代填人手機的比對範圍要同時查 `students` 和 `student_contacts`：

```ts
export async function checkContactPhoneDuplicate(rawPhone: string) {
  const normalized = normalizePhone(rawPhone)
  if (!normalized) return { isDuplicate: false, matches: [] }

  // 查 students
  const { data: studentMatch } = await supabase
    .from('students')
    .select('id, name_zh, phone')
    .eq('phone', normalized)
    .maybeSingle()

  // 查 student_contacts
  const { data: contactMatches } = await supabase
    .from('student_contacts')
    .select('id, name, phone, student_id, students(name_zh)')
    .eq('phone', normalized)

  const matches = [
    ...(studentMatch ? [{ type: 'student', ...studentMatch }] : []),
    ...(contactMatches ?? []).map(c => ({ type: 'contact', ...c })),
  ]

  return {
    isDuplicate: matches.length > 0,
    matches,
  }
}
```

**驗收**：
- [ ] 代填人手機欄位失焦時觸發重複比對
- [ ] 重複時顯示 amber 警示（提示文字與學生本人不同）
- [ ] 提示文字正確區分「學生本人」vs「關係人」重複
- [ ] 警示同樣需要顧問確認才能繼續
- [ ] commit：`fix: [3] 代填人手機加入重複偵測`

---

## 需手動到 Supabase Dashboard 執行的 Migration 清單

1. `..._normalize_existing_phones.sql`（第 1 項）

---

## 驗收清單

- [ ] `normalizePhone()` 函式建立，涵蓋所有 14 種格式
- [ ] 輸入 `0912-345-678` 與 `+886912345678` 都能命中同一筆重複
- [ ] 寫入 DB 的 phone 統一為純數字格式
- [ ] `/students/new` 不再出現 Runtime Error
- [ ] 代填人手機欄位有重複偵測，提示文字語意正確
- [ ] 所有修改均有獨立 commit
- [ ] Migration 清單產出
