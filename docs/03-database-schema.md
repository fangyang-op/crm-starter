# 03. 資料庫 Schema 完整文件

> **資料庫**:PostgreSQL 15+(Supabase Cloud)  
> **對應 SQL**:[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)  
> **ER 視覺圖**:[`06-erd.svg`](./06-erd.svg)

本文件描述每張表的設計用途、欄位語意、關聯、索引,作為實作與後續維護的依據。

---

## 索引

1. [Enum 列舉型別](#1-enum-列舉型別)
2. [使用者與角色](#2-使用者與角色)
3. [學生主檔](#3-學生主檔)
4. [成交與績效](#4-成交與績效)
5. [學校資料](#5-學校資料)
6. [選校表](#6-選校表)
7. [申請追蹤](#7-申請追蹤)
8. [文件版本](#8-文件版本)
9. [字數帳本](#9-字數帳本)
10. [成績與佣金](#10-成績與佣金)
11. [系統表](#11-系統表)

---

## 1. Enum 列舉型別

集中定義所有狀態類欄位的允許值。**修改 enum 必須走 migration**。

| Enum 名 | 用途 | 值 |
|---|---|---|
| `user_role` | 使用者角色 | `consultant` / `manager_frontend` / `manager_backend` / `admin` |
| `department` | 部門 | `frontend`(招生)/ `backend`(行政) |
| `student_status` | 學生狀態 | 13 種(見 PRD §5.1) |
| `lead_source_type` | 名單來源類型 | `self_developed` / `marketing_dept` / `consultant_referral` / `external_referrer` / `brand_introduction` / `other` |
| `document_type` | 文件類型 | `cv` / `sop` / `lor` / `transcript` / `other` |
| `score_type` | 成績類型 | `gpa` / `toefl` / `ielts` / `gre` / `gmat` / `sat` / `duolingo` / `other` |
| `application_status` | 學校申請狀態 | `pending_send` / `submitted` / `docs_required` / `interview` / `admitted` / `rejected` / `waitlisted` / `declined_by_us` / `enrolled` |
| `word_quota_transaction_type` | 字數交易類型 | `initial` / `addon` / `bonus` / `used` / `refund` / `adjustment` |

---

## 2. 使用者與角色

### 2.1 `profiles` — 使用者基本資料

延伸 Supabase 內建的 `auth.users`,儲存業務相關資訊。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | 對應 `auth.users.id` |
| `email` | TEXT UNIQUE | 登入信箱 |
| `full_name` | TEXT | 中文姓名 |
| `display_name` | TEXT | 系統顯示名(可選) |
| `avatar_url` | TEXT | 大頭照 |
| `role` | `user_role` | 4 階角色 |
| `department` | `department` | consultant 必填,manager 必填,admin 可空 |
| `is_active` | BOOLEAN | 離職後設 false 而非刪除 |
| `created_at` / `updated_at` | TIMESTAMPTZ | 標準時間欄 |

**設計重點:**
- 不直接寫 `auth.users`,避免污染 Supabase 內建表
- `is_active` 取代 hard delete,保留歷史紀錄一致性

### 2.2 `referrers` — 外部轉介人

非系統使用者(如合作品牌、學校老師、個人介紹人)。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | 名稱 |
| `type` | TEXT | `individual` / `organization` / `school` / `partner` |
| `contact_email` / `contact_phone` | TEXT | 聯絡資訊 |
| `notes` | TEXT | 備註 |
| `is_active` | BOOLEAN | |

**設計重點:** 與 profiles 嚴格切開,因為他們不登入系統。

---

## 3. 學生主檔

### 3.1 `students` — 學生主檔(專案核心)

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `full_name` | TEXT | 中文姓名 |
| `english_name` | TEXT | 英文姓名(申請用) |
| `email` / `phone` / `line_id` | TEXT | 聯絡 |
| `birth_date` | DATE | |
| `current_school` | TEXT | 當前/最高學歷學校 |
| `current_major` | TEXT | |
| `current_degree` | TEXT | `bachelor` / `master` / ... |
| `graduation_year` | INTEGER | |
| `target_country` | TEXT[] | `['US','UK']` |
| `target_degree` | TEXT | `master` / `bachelor` / `phd` / `language` / `tour` |
| `target_major` | TEXT | |
| `target_intake` | TEXT | `Fall 2025` |
| `status` | `student_status` | 當前狀態 |
| `frontend_consultant_id` | UUID FK profiles | 前端顧問 |
| `backend_consultant_id` | UUID FK profiles | 後端顧問 |
| `lead_source_type` | `lead_source_type` | 名單來源類型 |
| `lead_source_user_id` | UUID FK profiles | 內部來源(行銷部同事) |
| `lead_source_referrer_id` | UUID FK referrers | 外部轉介人 |
| `lead_source_note` | TEXT | 補充 |
| `notes` | TEXT | 一般備註 |
| `tags` | TEXT[] | 自由標籤 |
| `deleted_at` | TIMESTAMPTZ | Soft delete(非 NULL = 已刪) |
| `created_by` | UUID FK profiles | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**索引:**
- `status`(列表常依狀態篩選)
- `frontend_consultant_id`(查自己的學生)
- `backend_consultant_id`(查自己的學生)
- `deleted_at`(忽略已刪)

**設計重點:**
- 一筆主檔涵蓋所有資料,不分招生/行政表
- 兩位顧問各占一欄(對應「一前一後」業務模型)
- lead_source 三欄並存,類型 enum + 對應 user/referrer FK,業務語意清晰
- soft delete:不會真正刪除,以維持歷史與績效一致性

### 3.2 `student_status_history` — 狀態流轉紀錄

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `from_status` | `student_status` | 可空(初始建立時) |
| `to_status` | `student_status` | |
| `changed_by` | UUID FK profiles | |
| `note` | TEXT | 變更備註 |
| `changed_at` | TIMESTAMPTZ | |

**設計重點:** 用 trigger 自動寫入(見 migration SQL)。任何 `students.status` 變更都自動產生一筆。

### 3.3 `consultant_handovers` — 顧問交接紀錄

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `handover_type` | TEXT | `frontend_to_backend` / `frontend_swap` / `backend_swap` |
| `from_consultant_id` / `to_consultant_id` | UUID FK profiles | |
| `initiated_by` | UUID FK profiles | 通常是主管 |
| `reason` | TEXT | |
| `handed_at` | TIMESTAMPTZ | |

---

## 4. 成交與績效

### 4.1 `service_plans` — 預定方案

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `code` | TEXT UNIQUE | `US-MASTER-10` |
| `name` | TEXT | `美碩 10 校旗艦` |
| `description` | TEXT | |
| `base_price` | NUMERIC(10,2) | TWD |
| `currency` | TEXT DEFAULT 'TWD' | |
| `included_school_count` | INTEGER | |
| `included_word_quota` | INTEGER | |
| `scope_country` | TEXT[] | `['US']` 或 NULL=不限 |
| `scope_degree` | TEXT[] | |
| `is_active` | BOOLEAN | |
| `display_order` | INTEGER | UI 排序 |

### 4.2 `addon_pricing` — 加購單價

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `type` | TEXT UNIQUE | `extra_school` / `extra_word_per_1000` |
| `name` | TEXT | 顯示名稱 |
| `unit_price` | NUMERIC(10,2) | |
| `currency` | TEXT | |
| `is_active` | BOOLEAN | |

### 4.3 `deals` — 成交紀錄

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `plan_id` | UUID FK service_plans | |
| `extra_school_count` | INTEGER DEFAULT 0 | |
| `extra_word_quota` | INTEGER DEFAULT 0 | |
| `base_amount` | NUMERIC | 方案基礎 |
| `addon_amount` | NUMERIC | 加購總計 |
| `discount_amount` | NUMERIC | 優惠 |
| `final_amount` | NUMERIC | 最終 |
| `currency` | TEXT | |
| `discount_reason` | TEXT | |
| `signed_at` | DATE | 簽約日 |
| `contract_no` | TEXT | 合約編號 |
| `payment_status` | TEXT | `pending` / `partial` / `paid` |
| `notes` | TEXT | |
| `created_by` | UUID FK profiles | |

**設計重點:** 一位學生可能有多筆 deals(語言+碩士分開買),所以是 1:N。

### 4.4 `deal_commission_splits` — 績效拆分

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `deal_id` | UUID FK deals | |
| `recipient_user_id` | UUID FK profiles | 二擇一 |
| `recipient_referrer_id` | UUID FK referrers | 二擇一 |
| `role_in_deal` | TEXT | `primary_consultant` / `referrer` / `manager_bonus` |
| `percentage` | NUMERIC(5,2) | 例:65.00 |
| `amount` | NUMERIC(10,2) | 計算後實際金額 |
| `notes` | TEXT | |

**約束:**
```sql
CHECK (
  (recipient_user_id IS NOT NULL AND recipient_referrer_id IS NULL) OR
  (recipient_user_id IS NULL AND recipient_referrer_id IS NOT NULL)
)
```

**設計重點:** 一筆 deal 可有多筆拆分(顧問 + 轉介人),總和應為 100%。可以由觸發器驗證。

---

## 5. 學校資料

### 5.1 `schools` — 學校主檔

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `name_en` | TEXT NOT NULL | 英文名(申請用) |
| `name_zh` | TEXT | 中文名 |
| `short_name` | TEXT | 簡稱(`MIT`) |
| `country` | TEXT | `US` / `UK` / ... |
| `state_or_region` | TEXT | |
| `city` | TEXT | |
| `website` | TEXT | |
| `ranking_qs` | INTEGER | |
| `ranking_us_news` | INTEGER | |
| `is_partner` | BOOLEAN | 合作學校? |
| `partner_commission_rate` | NUMERIC(5,2) | 回傭率(%) |
| `partner_notes` | TEXT | |

### 5.2 `school_programs` — 學校系所

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `school_id` | UUID FK schools | |
| `program_name` | TEXT | `MS in Computer Science` |
| `degree_level` | TEXT | `master` / `phd` / `bachelor` |
| `major_category` | TEXT | `EE` / `CS` / `MBA` |
| `application_deadline_round1` | DATE | |
| `application_deadline_round2` | DATE | |
| `notes` | TEXT | |

---

## 6. 選校表

### 6.1 `school_lists` — 選校表(多版本)

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `version_number` | INTEGER | v1, v2, ... |
| `name` | TEXT | `V1 初版` |
| `is_locked` | BOOLEAN | 鎖定後不可改 |
| `is_current` | BOOLEAN | 當前主用版本 |
| `notes` | TEXT | |
| `created_by` | UUID FK profiles | |

**約束:** 同一學生的 `(student_id, version_number)` UNIQUE。同一學生只允許一個 `is_current = true`(用 partial unique index)。

### 6.2 `school_list_items` — 選校表項目

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `school_list_id` | UUID FK school_lists | |
| `school_id` | UUID FK schools | |
| `program_id` | UUID FK school_programs | 可選 |
| `program_name_override` | TEXT | 學校沒有對應 program 時手填 |
| `tier` | TEXT | `reach` / `match` / `safety` / `dream` |
| `display_order` | INTEGER | 排序 |
| `notes` | TEXT | |

---

## 7. 申請追蹤

### 7.1 `applications` — 申請紀錄(從鎖定的選校表展開)

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `school_id` | UUID FK schools | |
| `program_id` | UUID FK school_programs | |
| `program_name_override` | TEXT | |
| `source_school_list_item_id` | UUID FK school_list_items | 來源 |
| `status` | `application_status` | |
| `application_round` | TEXT | `Round 1` / `Regular` |
| `deadline` | DATE | |
| `submitted_at` | TIMESTAMPTZ | |
| `decision_at` | TIMESTAMPTZ | |
| `decision_notes` | TEXT | |
| `portal_url` | TEXT | |
| `portal_username` | TEXT | |
| `portal_password_encrypted` | TEXT | **AES-256-GCM 加密** |
| `portal_notes` | TEXT | |
| `application_fee` | NUMERIC | |
| `application_fee_paid` | BOOLEAN | |

**設計重點:**
- `portal_password_encrypted` 必須由 server-side 加密後寫入
- 解密金鑰存環境變數 `ENCRYPTION_KEY`
- 切勿用 DB function 加解密(避免金鑰落到 DB)

---

## 8. 文件版本

文件採三層架構:**Master** → **Variant**(學校客製)→ **Version**(每次修改)。

### 8.1 `documents_master` — 學生層級主版本

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `doc_type` | `document_type` | |
| `title` | TEXT | `主版 SOP` |
| `description` | TEXT | |
| `current_version_id` | UUID FK documents_master_versions | 當前版 |
| `is_archived` | BOOLEAN | |
| `created_by` | UUID FK profiles | |

### 8.2 `documents_master_versions` — 主版本歷史

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `master_id` | UUID FK documents_master | |
| `version_number` | INTEGER | v1, v2, ... |
| `content` | TEXT | 純文字內容(計算字數用) |
| `storage_path` | TEXT | Supabase Storage 路徑(若有原檔) |
| `word_count` | INTEGER | 此版字數 |
| `word_diff_from_previous` | INTEGER | 跟上版差多少字 |
| `change_note` | TEXT | 修改摘要 |
| `modified_by` | UUID FK profiles | |

### 8.3 `documents_variants` — 學校客製版本

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `master_id` | UUID FK documents_master | |
| `application_id` | UUID FK applications | 對應某學校 |
| `forked_from_master_version_id` | UUID FK documents_master_versions | Fork 自哪版 |
| `current_version_id` | UUID FK documents_variant_versions | |
| `is_finalized` | BOOLEAN | 已確認送出 |

**約束:** `(master_id, application_id)` UNIQUE — 一份 Master 對一個申請只有一份 Variant。

### 8.4 `documents_variant_versions` — 客製版本歷史

(欄位同 master_versions,只是父表是 variant)

**字數扣減觸發:**
- 寫入 `documents_master_versions` 或 `documents_variant_versions` 且 `word_diff > 0` 時
- DB trigger 自動寫入 `word_quota_ledger`(交易類型 `used`)

---

## 9. 字數帳本

### 9.1 `word_quota_ledger` — 字數交易帳本

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `transaction_type` | `word_quota_transaction_type` | |
| `amount` | INTEGER | 正:加 / 負:扣 |
| `balance_after` | INTEGER | 此筆後餘額(冗餘但便於查) |
| `description` | TEXT | 人類可讀說明 |
| `related_deal_id` | UUID FK deals | 來源:成交方案 / 加購 |
| `related_master_version_id` | UUID FK documents_master_versions | 來源:Master 修改 |
| `related_variant_version_id` | UUID FK documents_variant_versions | 來源:Variant 修改 |
| `created_by` | UUID FK profiles | |

**索引:** `(student_id, created_at)` — 查單一學生時間軸的核心索引。

**設計重點:**
- **絕不允許 UPDATE/DELETE,只能 INSERT** — 像會計帳本一樣只能追加
- 餘額查詢:`SELECT SUM(amount) FROM word_quota_ledger WHERE student_id = ?`
- `balance_after` 冗餘儲存,加速「最近餘額」查詢

---

## 10. 成績與佣金

### 10.1 `academic_scores` — 學業/語言成績

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | |
| `score_type` | `score_type` | |
| `total_score` | TEXT | TEXT 因為 GPA 3.85 / TOEFL 100 / GRE 330+5 格式不一 |
| `sub_scores` | JSONB | 細項:`{reading:25,listening:26,...}` |
| `test_date` | DATE | |
| `expiry_date` | DATE | 成績有效期(有些 2 年) |
| `certificate_storage_path` | TEXT | 證書檔案 |
| `is_official` | BOOLEAN | 正式 / 模擬 |
| `notes` | TEXT | |

### 10.2 `commission_records` — 合作學校回傭

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `application_id` | UUID FK applications | |
| `school_id` | UUID FK schools | |
| `student_id` | UUID FK students | |
| `expected_amount` | NUMERIC | 預計 |
| `actual_amount` | NUMERIC | 實收 |
| `currency` | TEXT DEFAULT 'USD' | |
| `status` | TEXT | `expected` / `invoiced` / `received` / `cancelled` |
| `invoiced_at` | DATE | |
| `received_at` | DATE | |
| `notes` | TEXT | |

---

## 11. 系統表

### 11.1 `activity_log` — 統一事件流

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK students | 主關聯 |
| `actor_id` | UUID FK profiles | 操作者 |
| `action` | TEXT | `status_changed` / `document_revised` / `deal_created` / ... |
| `entity_type` | TEXT | `deal` / `document` / `application` / ... |
| `entity_id` | UUID | 對應實體 ID |
| `payload` | JSONB | 結構化資料(舊值/新值) |
| `description` | TEXT | 人類可讀描述 |
| `created_at` | TIMESTAMPTZ | |

**索引:** `(student_id, created_at DESC)` — 學生 360° 視圖的時間軸主索引。

**設計重點:** 所有重要事件都寫一筆,不只給人看,也給未來 AI 分析用。

---

## 命名與約定總覽

| 項目 | 約定 |
|---|---|
| 資料表名 | `snake_case` 複數 |
| 主鍵 | 統一 `id` UUID |
| 外鍵 | `<entity>_id` |
| 時間戳 | `<event>_at` (`signed_at`, `submitted_at`) |
| 期間 | `<event>_date`(僅日期無時間) |
| 布林 | `is_<adjective>`(`is_active`, `is_locked`) |
| 加密欄位 | `<field>_encrypted` |
| Soft delete | `deleted_at`(非 NULL = 已刪除) |
| 預設時區 | 一律 `TIMESTAMPTZ`,用 `Asia/Taipei` 顯示 |
