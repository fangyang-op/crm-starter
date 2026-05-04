# 留學代辦 CRM 系統 — Claude Code 工作指引

> 這份檔案是 Claude Code 啟動時的**第一手規則書**。所有開發行為必須遵守此處規範。  
> 修改本檔請慎重 — 它是整個專案的憲法。

---

## 🎯 專案核心

**這是一家位於台灣的留學代辦公司的內部 CRM 系統。**

- 服務地區:美、英、加、澳的大學/碩士申請,輔以語言學校、遊學團
- 使用對象:公司內部顧問(15-50 人,4 階角色)
- 設計哲學:**學生中心化** — 一位學生 = 一個專案,所有資訊與事件都掛在學生主檔上

---

## 🛠 技術棧(已鎖定,不要擅自更換)

| 層 | 技術 |
|---|---|
| 前端框架 | **Next.js 14**(App Router)+ TypeScript |
| 樣式 | **Tailwind CSS** + **shadcn/ui** |
| 後端/資料庫 | **Supabase**(PostgreSQL + Auth + Storage + Realtime) |
| 權限 | Supabase **Row Level Security (RLS)** |
| 部署 | **Vercel**(前端)+ Supabase Cloud(後端) |
| 表單 | react-hook-form + zod |
| 資料抓取 | TanStack Query (`@tanstack/react-query`) |
| 圖表 | Recharts |
| 套件管理 | pnpm(優先)或 npm |

> ⚠️ **不要**引入額外的 ORM(如 Prisma、Drizzle)— 用 Supabase JS client 直接讀寫即可,保持簡單。  
> ⚠️ **不要**自己造輪子寫權限系統 — 一律用 Supabase RLS。

---

## 📁 專案資料夾結構

```
crm-system/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 登入相關(無側邊欄 layout)
│   ├── (dashboard)/        # 主應用(有側邊欄 layout)
│   │   ├── students/
│   │   ├── deals/
│   │   ├── schools/
│   │   ├── applications/
│   │   └── ...
│   ├── api/                # API Routes(僅在必要時使用,優先用 Server Component)
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn/ui 原生元件(不要改)
│   ├── students/           # 學生相關元件
│   ├── shared/             # 跨模組共用元件
│   └── layouts/
├── lib/
│   ├── supabase/           # Supabase client(server/client 分開)
│   ├── utils/              # 工具函式
│   ├── validators/         # zod schemas
│   └── constants/          # 常數(狀態列舉、角色定義)
├── types/                  # TypeScript 型別定義
│   └── database.ts         # 從 Supabase auto-generate
├── docs/                   # 所有文件(本資料夾)
├── supabase/
│   ├── migrations/         # SQL migration 檔案
│   └── seed.sql            # 測試資料
└── public/
```

---

## 📜 命名與編碼慣例

### 命名
- **資料表名**:`snake_case` 複數(`students`, `deals`, `school_lists`)
- **欄位名**:`snake_case`(`frontend_consultant_id`, `signed_at`)
- **TypeScript 變數/函式**:`camelCase`
- **TypeScript 型別/Interface/Component**:`PascalCase`
- **常數**:`SCREAMING_SNAKE_CASE`
- **檔案命名**:
  - React 元件 → `PascalCase.tsx`(`StudentList.tsx`)
  - 工具函式 → `kebab-case.ts`(`format-currency.ts`)
  - Hook → `use-camel-case.ts`(`use-students.ts`)

### 程式碼風格
- **永遠寫 TypeScript**,禁止 `.js` 檔(除了 config)
- **禁用 `any`** — 真的不知道型別就用 `unknown` 並收斂
- **優先 Server Component**,只有需要互動才用 `'use client'`
- 元件超過 200 行就拆檔
- 共用邏輯抽成 hook 或 util

### Import 順序
```typescript
// 1. React/Next 內建
import { useState } from 'react'
import Link from 'next/link'

// 2. 第三方套件
import { z } from 'zod'

// 3. 本專案絕對路徑(用 @/ alias)
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

// 4. 相對路徑
import { formatPrice } from './utils'

// 5. 型別
import type { Student } from '@/types/database'
```

---

## 🚫 絕對禁忌(違反等於 PR 被拒)

1. ❌ **絕對不要**在 client component 使用 `service_role` key — 一律用 `anon` key 配 RLS
2. ❌ **絕對不要**把 `SUPABASE_SERVICE_ROLE_KEY` 丟到任何前端可看見的地方
3. ❌ **絕對不要**把 portal 帳密、學生身分證等敏感資料**明文**寫入 DB — 必須加密
4. ❌ **絕對不要**繞過 RLS — 即使開發時遇到權限阻擋,也要修 RLS,不要關 RLS
5. ❌ **絕對不要**直接 `DELETE` 學生資料 — 用 soft delete(`deleted_at` 欄位)
6. ❌ **絕對不要**在 client side 計算金額/拆分/字數 — 必須在 DB function 或 server action
7. ❌ **絕對不要**自行修改 `components/ui/` 內 shadcn 原生元件 — 要改就 wrapper 一層
8. ❌ **絕對不要**引入未在 `package.json` 註冊的 npm 套件就 import
9. ❌ **絕對不要**在沒讀 `docs/` 對應文件就動手寫該模組
10. ❌ **絕對不要**寫死台灣使用者的時區為 UTC — 一律用 `Asia/Taipei`,DB 存 `TIMESTAMPTZ`

---

## ✅ 開發必做(每次提交前自我檢查)

- [ ] `pnpm run typecheck` 通過(零錯誤)
- [ ] `pnpm run lint` 通過
- [ ] `pnpm run build` 成功
- [ ] 新增的資料表在 `docs/03-database-schema.md` 有更新文件
- [ ] 新增的功能在對應 Phase 的 roadmap 有勾選
- [ ] RLS policy 測試(切換不同角色帳號驗證可見性)
- [ ] 敏感欄位經過加密處理
- [ ] 寫了至少一個 Server Action 或 Route 的測試(若有業務邏輯)

---

## 🧭 開發流程(請遵循 Phase 順序)

當你不知道該做什麼時,**先讀 `docs/04-roadmap.md`**,找到目前的 Phase,從未完成的最上面一項開始。

每個 Phase 完成後:
1. 在 `docs/04-roadmap.md` 把該項目打勾
2. 跑 typecheck + build
3. commit:`git commit -m "feat(phase-X): <description>"`

**目前狀態:Phase 0 尚未開始**

---

## 🔐 環境變數規範

`.env.local` 必須包含:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 僅 server-side 使用
ENCRYPTION_KEY=                 # 用於加密 portal 密碼,32 bytes hex
```

**永遠不要 commit `.env.local`,但要維護 `.env.example`**。

---

## 🤖 給 Claude Code 的工作守則

當使用者(專案擁有者)下指令時:

1. **遇到歧義先問**:不要猜,問清楚再動手
2. **動手前說明計畫**:先簡述「我打算做 A、B、C」,獲得確認再執行
3. **修檔小步快跑**:一次改一個邏輯單位,不要批量重構
4. **遇到禁忌主動拒絕**:見上方「絕對禁忌」清單,違反就停下來告訴使用者
5. **測試後再回報**:跑過 typecheck / build 才說「完成」
6. **不確定 RLS 寫法時**:讀 `docs/05-rls-policies.md`,沒有的就提問再寫
7. **每完成一個小任務**:更新對應 docs(若 schema/UI/business logic 有變)

---

## 📚 必讀文件清單(按重要性)

| 文件 | 何時讀 |
|---|---|
| `docs/04-roadmap.md` | **每次開工前** — 知道現在做什麼 |
| `docs/03-database-schema.md` | 動到 DB 之前 |
| `docs/05-rls-policies.md` | 寫 RLS 或除錯權限問題時 |
| `docs/08-business-logic.md` | 寫業務邏輯時(狀態機/字數/拆分) |
| `docs/07-design-system.md` | 寫 UI 元件時 |
| `docs/01-prd.md` | 不確定需求意圖時 |
| `docs/02-architecture.md` | 思考架構決策時 |

---

## 🆘 卡住時怎麼辦

1. 讀對應的 `docs/` 文件
2. 仍不確定 → **問使用者**(不要硬猜)
3. 出現預期外的錯誤 → 回報、暫停,不要 hack 過去
4. 發現文件矛盾 → 指出來、請使用者裁示

> 「乾淨地停下來」永遠優於「硬寫一個會爆炸的解法」。
