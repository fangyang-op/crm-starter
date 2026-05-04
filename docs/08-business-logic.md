# 08. 核心業務邏輯

> 系統的「靈魂」都在此處。**任何看似簡單的計算都不要直覺地寫**,先讀此文件確認規則。

---

## 1. 學生狀態機

### 1.1 狀態總覽

13 個狀態分 3 類:

```
招生階段 ─────────────────── 申請階段 ─────────────────── 終止
new_lead ─→ contacted        onboarding ─→ school_selection    enrolled (✅)
   ↓                             ↓             ↕
contacted ─→ consulting        school_selection ↔ document_prep      
   ↓                                ↓
consulting ─→ qualified         document_prep ─→ submitting
   ↓                                ↓
qualified ─→ closed_won         submitting ─→ awaiting_decision
                                    ↓
                                awaiting_decision ─→ decision_making
                                    ↓
                                decision_making ─→ pre_departure
                                    ↓
                                pre_departure ─→ enrolled

[特殊]
任何狀態 → paused            (可恢復)
任何招生階段 → disqualified  (招生失敗,終止)
任何成交後階段 → terminated  (退費,終止)
paused → 原狀態              (恢復)
```

### 1.2 合法 Transitions(只能依下表變動)

```typescript
// lib/constants/student-status-transitions.ts
export const ALLOWED_TRANSITIONS: Record<StudentStatus, StudentStatus[]> = {
  // 招生階段
  new_lead:        ['contacted', 'disqualified', 'paused'],
  contacted:       ['consulting', 'disqualified', 'paused'],
  consulting:      ['qualified', 'contacted', 'disqualified', 'paused'],
  qualified:       ['closed_won', 'consulting', 'disqualified', 'paused'],
  
  // 成交分水嶺
  closed_won:      ['onboarding', 'terminated', 'paused'],
  
  // 申請階段
  onboarding:      ['school_selection', 'terminated', 'paused'],
  school_selection: ['document_prep', 'onboarding', 'terminated', 'paused'],
  document_prep:   ['submitting', 'school_selection', 'terminated', 'paused'],
  submitting:      ['awaiting_decision', 'document_prep', 'terminated', 'paused'],
  awaiting_decision: ['decision_making', 'terminated', 'paused'],
  decision_making: ['pre_departure', 'awaiting_decision', 'terminated', 'paused'],
  pre_departure:   ['enrolled', 'terminated', 'paused'],
  
  // 終止狀態(無 transition)
  enrolled:        [],
  terminated:      [],
  disqualified:    [],
  
  // 暫緩(可恢復至任意非終止狀態)
  paused:          ['new_lead','contacted','consulting','qualified','closed_won',
                    'onboarding','school_selection','document_prep','submitting',
                    'awaiting_decision','decision_making','pre_departure'],
}
```

### 1.3 狀態變更要做的事

每次 transition,系統自動執行(由 DB trigger 或 server action):

| 觸發 | 動作 |
|---|---|
| 任何 transition | 寫入 `student_status_history` |
| 任何 transition | 寫入 `activity_log`(action: `status_changed`) |
| → `closed_won` | 提示前端顧問派遣後端顧問 |
| → `closed_won` | 檢查是否已有 `deals` 紀錄,若無則 reject |
| → `onboarding` | 確認 `backend_consultant_id` 已填,若無則 reject |
| → `enrolled` | 找出 `applications.status = 'enrolled'` 的 application,若無則 reject |
| → `enrolled` | 觸發合作學校 `commission_records` 自動建立 |
| → `terminated` | 提示是否退費(後續可加退款流程) |

### 1.4 UI 顯示

下拉選擇狀態時,**只顯示合法的下一狀態**,不要全部都顯示讓使用者誤選。

```typescript
// 用法
const allowed = ALLOWED_TRANSITIONS[currentStatus]
// 在 <Select> 只 render allowed 選項
```

---

## 2. 字數帳本邏輯

### 2.1 帳本基本概念

```
餘額 = SUM(所有 word_quota_ledger 的 amount)
```

每筆交易都是 **append-only**(不能改、不能刪),類似銀行對帳單。

### 2.2 交易類型對應規則

| transaction_type | 觸發場景 | amount 正負 | 來源關聯 |
|---|---|---|---|
| `initial` | 簽約成交時(從 plan 帶入) | + (依方案) | `related_deal_id` |
| `addon` | 成交時加購字數 | + (依加購數) | `related_deal_id` |
| `bonus` | 顧問主動「養字」 | + (顧問填寫) | 無 |
| `used` | 文件版本修改 | - (字數差) | `related_master_version_id` 或 `related_variant_version_id` |
| `refund` | 撤銷某次修改(管理員操作) | + (還回) | 對應 version_id |
| `adjustment` | 主管手動調整(極少用) | ±(填寫) | 無 |

### 2.3 字數差(diff)計算

每次儲存文件版本時,需計算與前一版的字數差:

```typescript
// lib/utils/word-diff.ts
import { diffWords } from 'diff'

export function calculateWordDiff(prev: string, current: string): {
  prevCount: number
  currentCount: number
  wordsChanged: number  // 此版動到的字數(被改/新增/刪除的字總和)
} {
  const prevCount = countWords(prev)
  const currentCount = countWords(current)
  
  const changes = diffWords(prev, current)
  let wordsChanged = 0
  for (const part of changes) {
    if (part.added || part.removed) {
      wordsChanged += countWords(part.value)
    }
  }
  
  return { prevCount, currentCount, wordsChanged }
}

// 中英文字數計算
function countWords(text: string): number {
  // 中文按字計、英文按詞計
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return chineseChars + englishWords
}
```

### 2.4 扣字數規則

**修改一次扣多少?業務決定的核心**

實作時兩種方案,**先用方案 A**(簡單明確,業務好溝通):

#### 方案 A:扣「動到的字數」(推薦)
- 每次儲存版本時,計算 `wordsChanged`(被改/新增/刪除的字數)
- 從帳本扣 `wordsChanged`
- 例:原文 1000 字,改了 50 字 → 扣 50

#### 方案 B:扣字數絕對差
- 扣 `abs(currentCount - prevCount)`
- 例:原文 1000 字,改完仍 1000 字(替換等量) → 扣 0
- ⚠️ 業務不公平,顧問可以「等量替換」逃過扣款

**選方案 A**,但提供「免扣保留版」機制(見下節)。

### 2.5 免扣保留版

業務情境:後端顧問改了大段文字,但「想保留先前版本作為對比」,不想算到字數。

實作:版本編輯介面提供「儲存為草稿(不入帳)」按鈕,寫到別的暫存表 `document_drafts`,不進入正式版本流。確認後再「正式儲存」才扣字數。

> Phase 3 之後再考慮加,MVP 不做。

### 2.6 餘額計算 SQL

```sql
-- 即時計算餘額
SELECT 
  student_id,
  COALESCE(SUM(amount), 0) AS balance
FROM word_quota_ledger
WHERE student_id = $1
GROUP BY student_id;
```

效能優化(資料量大時):每筆交易寫入時同時更新 `balance_after` 欄位,讀取時直接拿最新一筆的 `balance_after`。

```sql
-- 拿最新餘額(快)
SELECT balance_after FROM word_quota_ledger
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT 1;
```

### 2.7 觸發器:自動寫入 ledger

文件版本寫入時,DB trigger 自動建立 ledger 紀錄:

```sql
CREATE OR REPLACE FUNCTION fn_write_ledger_on_version_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_current_balance INTEGER;
BEGIN
  -- 找出對應的 student_id
  IF TG_TABLE_NAME = 'documents_master_versions' THEN
    SELECT student_id INTO v_student_id 
    FROM documents_master WHERE id = NEW.master_id;
  ELSIF TG_TABLE_NAME = 'documents_variant_versions' THEN
    SELECT dm.student_id INTO v_student_id
    FROM documents_variants dv
    JOIN documents_master dm ON dm.id = dv.master_id
    WHERE dv.id = NEW.variant_id;
  END IF;
  
  -- 字數差 > 0 才扣
  IF NEW.word_diff_from_previous > 0 THEN
    -- 取當前餘額
    SELECT COALESCE(balance_after, 0) INTO v_current_balance
    FROM word_quota_ledger
    WHERE student_id = v_student_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    INSERT INTO word_quota_ledger (
      student_id,
      transaction_type,
      amount,
      balance_after,
      description,
      related_master_version_id,
      related_variant_version_id,
      created_by
    ) VALUES (
      v_student_id,
      'used',
      -NEW.word_diff_from_previous,
      v_current_balance - NEW.word_diff_from_previous,
      '文件修改扣字數',
      CASE WHEN TG_TABLE_NAME = 'documents_master_versions' THEN NEW.id ELSE NULL END,
      CASE WHEN TG_TABLE_NAME = 'documents_variant_versions' THEN NEW.id ELSE NULL END,
      NEW.modified_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

完整 SQL 在 `supabase/migrations/0001_init.sql`。

---

## 3. 績效拆分計算

### 3.1 預設情境

**情境 A:單一顧問成交,無轉介**

```
final_amount = 120,000
splits:
  - role: primary_consultant, recipient_user_id: <顧問A>, percentage: 100.00, amount: 120,000
```

**情境 B:有轉介人**

```
final_amount = 120,000
splits:
  - role: primary_consultant, recipient_user_id: <顧問A>, percentage: 65.00, amount: 78,000
  - role: referrer, recipient_user_id 或 recipient_referrer_id: <轉介人>, percentage: 35.00, amount: 42,000
```

**情境 C:額外加成主管獎金**(主管手動發放)

```
splits:
  - role: primary_consultant, percentage: 65.00
  - role: referrer, percentage: 35.00
  - role: manager_bonus, recipient_user_id: <主管>, percentage: 5.00 (額外,不影響顧問拆分)
```

### 3.2 約束規則

- **primary_consultant + referrer 加總必須 = 100%**(若有 referrer)
- 沒有 referrer 時,primary_consultant = 100%
- `manager_bonus` 是**額外的**,不計入主拆分總和
- 任何 split 都必須關聯到 `recipient_user_id` 或 `recipient_referrer_id`(二擇一,CHECK 約束已在 SQL)

### 3.3 計算流程(server action)

```typescript
// app/students/[id]/deal/actions.ts
'use server'

export async function createDeal(input: DealInput) {
  // 1. 驗證輸入(zod)
  const validated = dealSchema.parse(input)
  
  // 2. 計算金額
  const baseAmount = validated.plan.basePrice
  const addonAmount = 
    validated.extraSchoolCount * EXTRA_SCHOOL_PRICE +
    validated.extraWordQuota / 1000 * EXTRA_WORD_PRICE_PER_1000
  const finalAmount = baseAmount + addonAmount - validated.discountAmount
  
  // 3. 驗證拆分加總 = 100(若有拆分)
  const mainSplits = validated.splits.filter(s => s.role !== 'manager_bonus')
  const sumPct = mainSplits.reduce((acc, s) => acc + s.percentage, 0)
  if (Math.abs(sumPct - 100) > 0.01) {
    throw new Error('主拆分加總必須 = 100%')
  }
  
  // 4. 計算每筆 amount
  const splitsWithAmount = validated.splits.map(s => ({
    ...s,
    amount: Math.round(finalAmount * s.percentage / 100)
  }))
  
  // 5. transaction 寫入 deals + splits
  const supabase = await createServerClient()
  // ... transaction
}
```

### 3.4 拆分比例可改

預設 65/35,但顧問與轉介人可協商不同比例(例:80/20)。UI 提供調整介面,但**鎖定**「主拆分加總 = 100%」。

---

## 4. 文件 Master / Variant Fork 流程

### 4.1 概念

```
Master(學生層級主版)
    │
    │ ── v1 (1500 字)
    │ ── v2 (1520 字, +20)
    │ ── v3 (1480 字, -40, 但動到 60 字)  ← current_version
    │
    └── Fork to 哥大 EE → Variant
            │
            │ ── v1 (從 Master v3 拷貝,初始狀態,不扣字數)
            │ ── v2 (按學校特色微調 80 字, 扣 80)
            │ ── v3 (再修 30 字, 扣 30)
```

### 4.2 Fork 規則

- Fork 動作 = 建立新 Variant + 同時建立 Variant v1(內容拷貝自 Master 該版)
- **Fork 本身不扣字數**(認為是準備動作)
- 但要在 `activity_log` 記錄 fork 事件

### 4.3 Variant 後續修改

- Variant v1 → v2 之後,每次修改正常按字數差扣字
- Variant 不能再 fork(僅 Master 可被 fork)

### 4.4 SQL 實作

Master fork 的 transaction:

```sql
-- 1. 建立 documents_variants 紀錄
INSERT INTO documents_variants (master_id, application_id, forked_from_master_version_id, ...)
RETURNING id;

-- 2. 建立 variant 第一版,內容拷貝自 master 該版
INSERT INTO documents_variant_versions (
  variant_id, version_number, content, word_count, word_diff_from_previous, ...
)
SELECT 
  $variant_id, 1, content, word_count, 0,  -- diff = 0 = 不扣
  ...
FROM documents_master_versions
WHERE id = $forked_from_master_version_id;

-- 3. 寫 activity_log
INSERT INTO activity_log (...) VALUES (..., 'document_forked', ...);
```

---

## 5. Portal 帳密加密 / 解密

### 5.1 演算法選擇

**AES-256-GCM**(認證加密,內建完整性檢查)

### 5.2 Node.js 實作

```typescript
// lib/crypto.ts (僅 server-side)
import { 
  createCipheriv, createDecipheriv, randomBytes 
} from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)  // GCM 推薦 12 bytes
  const cipher = createCipheriv(ALGO, KEY, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()
  
  // 編碼格式:base64( iv | authTag | ciphertext )
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  
  const decipher = createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(authTag)
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString('utf8')
}
```

### 5.3 寫入流程(Server Action)

```typescript
'use server'

export async function setApplicationPortalCredentials(
  applicationId: string,
  username: string,
  password: string
) {
  // 驗證權限...
  
  const encrypted = encrypt(password)
  
  const supabase = await createServerClient()
  await supabase.from('applications').update({
    portal_username: username,
    portal_password_encrypted: encrypted
  }).eq('id', applicationId)
}
```

### 5.4 讀取流程

UI 預設遮蔽密碼。使用者點「複製」 → 觸發 server action → 解密回傳到 client。

```typescript
'use server'

export async function revealPortalPassword(applicationId: string): Promise<string> {
  const supabase = await createServerClient()
  // RLS 自動驗證權限
  const { data, error } = await supabase
    .from('applications')
    .select('portal_password_encrypted')
    .eq('id', applicationId)
    .single()
  
  if (error || !data?.portal_password_encrypted) {
    throw new Error('無權存取或密碼未設定')
  }
  
  // 寫 activity log
  await supabase.from('activity_log').insert({
    student_id: ...,
    action: 'portal_password_revealed',
    entity_type: 'application',
    entity_id: applicationId,
  })
  
  return decrypt(data.portal_password_encrypted)
}
```

### 5.5 金鑰管理

- `ENCRYPTION_KEY` 用 `openssl rand -hex 32` 產生
- 存於 `.env.local`(本機)/ Vercel 環境變數(production)
- **絕不**寫入 git
- 若需 rotate(更換)金鑰:寫一次性 script 解密舊資料 → 用新金鑰加密回去
- 金鑰丟失 = 所有 portal 密碼解不出來,需請後端重新填寫

### 5.6 ⚠️ 絕對禁忌

- ❌ 用 PostgreSQL `pgcrypto` 在 DB 內加解密(金鑰會落到 DB)
- ❌ 把 `ENCRYPTION_KEY` 用 `NEXT_PUBLIC_*` 暴露
- ❌ 在 client side 解密
- ❌ 同金鑰用在不同用途(只用於 portal 密碼)

---

## 6. 學生 360° 視圖的時間軸

時間軸 = `activity_log WHERE student_id = ?` ORDER BY `created_at DESC`

事件類型對應顯示:

| action | 圖示 | 說明範本 |
|---|---|---|
| `status_changed` | `<ArrowRight>` | `{actor} 將狀態從 {from} 改為 {to}` |
| `consultant_assigned` | `<UserPlus>` | `{actor} 指派 {to_consultant} 為 {role}` |
| `deal_created` | `<HandShake>` | `{actor} 建立成交 NT$ {amount}` |
| `school_list_locked` | `<Lock>` | `{actor} 鎖定選校表 v{version}` |
| `application_submitted` | `<Send>` | `{actor} 送出 {school} 申請` |
| `document_revised` | `<FileEdit>` | `{actor} 修改 {doc_type},扣 {words} 字` |
| `document_forked` | `<GitFork>` | `{actor} Fork {doc_type} 給 {school}` |
| `portal_password_revealed` | `<Eye>` | `{actor} 查看 {school} 帳密` |
| `commission_received` | `<DollarSign>` | `{school} 回傭 ${amount} 已入帳` |

---

## 7. Workload(工作量能)計算

每位後端顧問當前手上的「實際負擔」用權重計算,而非單純算學生數。

```typescript
const STAGE_WEIGHTS = {
  onboarding:        1.0,
  school_selection:  1.5,
  document_prep:     2.5,  // 最重的階段
  submitting:        2.0,
  awaiting_decision: 0.5,
  decision_making:   1.0,
  pre_departure:     0.8,
}

const workload = students
  .filter(s => s.backend_consultant_id === userId)
  .reduce((sum, s) => sum + (STAGE_WEIGHTS[s.status] || 0), 0)
```

主管派發新學生時看 workload 排行,優先派給負擔較輕的顧問。

實作:DB View `consultant_workload`(在 Phase 5 加上)。

---

## 8. 邊界情況提醒

### 學生離職顧問處理

- 顧問 `is_active = false` 後,不刪除其關聯的學生
- 主管必須先把學生轉派給其他顧問(寫 `consultant_handovers`)
- UI 提示主管:「該顧問尚有 N 位學生未交接」

### 字數變負數

- 業務上不應發生(扣到 0 就應該 reject 修改)
- 防呆:server action 在扣字之前先檢查餘額,不足則 reject 並提示「需加購字數或申請養字」

### 已成交但要退費

- 學生狀態 → `terminated`
- 不刪除 `deals` 或 `splits`(留歷史)
- 寫 `activity_log` 註記退費金額
- 績效拆分**不自動撤回**(需手動處理會計)

### 學生重複建立

- 系統不強制 unique(同名學生可能存在)
- 但前端在新增前以「姓名 + email」搜尋,提示「找到 N 位類似學生,確認新建?」
