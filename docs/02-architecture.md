# 02. 技術架構與選型決策

> 本文件記錄**為什麼**選擇這套架構,作為未來任何架構變動的決策依據。

---

## 1. 整體架構圖

```
┌──────────────────────────────────────────────────────────────┐
│                        使用者裝置                            │
│              (顧問的瀏覽器 - Chrome / Edge / Safari)        │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                      Vercel Edge                             │
│     Next.js 14 App Router (RSC + Server Actions + API)       │
│     ─────────────────────────────────────────────────        │
│     • 頁面渲染(Server Components)                          │
│     • Form 處理(Server Actions)                            │
│     • 業務邏輯(僅敏感計算放此,其餘走前端 client)         │
└──────────────────────┬───────────────────────────────────────┘
                       │ Supabase JS Client
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase Cloud                            │
│  ┌─────────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐   │
│  │ PostgreSQL  │  │  Auth    │  │Storage │  │ Realtime │   │
│  │ + RLS       │  │ (JWT)    │  │ (S3)   │  │ (WS)     │   │
│  └─────────────┘  └──────────┘  └────────┘  └──────────┘   │
│                       ▲                                      │
│                       │ pg functions / triggers              │
│                       │ (字數計算、狀態驗證、活動日誌)        │
└──────────────────────────────────────────────────────────────┘
                       
                       未來擴充(Phase 7):
                       
                       Anthropic Claude API
                              ↑
                       MCP Server(暴露 DB 給 Claude)
```

---

## 2. 技術選型理由

### 2.1 為何選 Next.js 14 (App Router)

| 候選 | 選用理由 |
|---|---|
| **Next.js 14 (App Router)** ✅ | RSC 大幅減少 client JS、Server Actions 簡化表單處理、Vercel 一鍵部署、TypeScript 友善 |
| Remix | 優秀但生態較小,招募人才較難 |
| 純 React + Express | 太多輪子要造,15-50 人規模不值得 |
| Vue/Nuxt | 不選;Tailwind/shadcn 生態以 React 為主 |

### 2.2 為何選 Supabase

**從 Firebase 遷移的關鍵理由:**

| 需求 | Firebase 痛點 | Supabase 優勢 |
|---|---|---|
| 學生 ↔ 文件 ↔ 字數 多表 JOIN 查詢 | Firestore 不支援 JOIN | PostgreSQL 原生支援 |
| 字數帳本(類銀行流水) | 文件式 DB 難以維護一致性 | SQL transaction + 觸發器 |
| 角色階層權限 | 需在 client/cloud function 自寫 | RLS 內建,一行 SQL 搞定 |
| AI 落點分析(Phase 7) | 需自寫複雜聚合 | SQL + pg vectors 完美支援 |
| 文件版本(每版可能 > 1MB) | Firestore 單筆 1MB 限制 | Supabase Storage + DB 引用 |
| 績效拆分計算 | 文件鎖定難 | DB transaction 保證原子性 |

**為什麼不選其他 PostgreSQL 方案:**

- **Neon / Vercel Postgres**:純 DB,需自建 Auth + Storage + RLS,工程成本高
- **PlanetScale**:MySQL,缺少 PostgreSQL 的 JSONB / array / RLS
- **自架 PostgreSQL**:運維負擔重,15-50 人規模不划算

### 2.3 為何選 shadcn/ui

- **不是套件**,是程式碼複製過來的元件 → 完全可改、不被綁架
- 基於 **Radix UI**(無障礙原生支援)+ **Tailwind**
- 設計 token 化,容易整合公司品牌色

### 2.4 為何選 TanStack Query(伺服器狀態)

- React Query 已是業界標準
- 與 Supabase Realtime 完美結合(背景重抓 vs 即時推送)
- 緩存、樂觀更新、無痛分頁

---

## 3. 資料流模式

### 3.1 讀取(Read)

```
頁面進入
   ↓
Server Component
   ↓
createClient (server)  → Supabase
   ↓                     [RLS 自動驗證]
首次資料下傳
   ↓
Client Component(若有互動)
   ↓
TanStack Query
   ↓
createClient (browser) → Supabase
   ↓                     [RLS 同樣驗證]
互動更新
```

### 3.2 寫入(Write)

**所有寫入優先走 Server Action**:

```typescript
// app/students/actions.ts
'use server'

export async function createStudent(formData: FormData) {
  const supabase = createServerClient()  // 帶有使用者的 JWT
  // RLS 自動把 auth.uid() 注入,寫入會被驗證
  const { data, error } = await supabase
    .from('students')
    .insert({ ... })
    .select()
    .single()
  
  if (error) throw error
  revalidatePath('/students')
  return data
}
```

### 3.3 敏感運算放哪?

| 運算類型 | 位置 | 原因 |
|---|---|---|
| 字數差異計算 | DB Function (PL/pgSQL) | 確保資料一致性,client 不可信 |
| 績效拆分計算 | Server Action | 涉及金錢,需 server 驗證 |
| Portal 密碼加密 | Server Action(insert 前) | 加密金鑰不可暴露 client |
| 狀態流轉驗證 | DB Trigger | 防止前端跳過驗證 |
| 顯示字數差異 | Client | 純展示,無安全顧慮 |

---

## 4. 資料夾結構決策

```
app/
├── (auth)/              # group route, 無側邊欄
│   ├── login/
│   └── signup/
│
├── (dashboard)/         # group route, 有側邊欄
│   ├── layout.tsx       # 側邊欄 + 頂部導覽
│   │
│   ├── page.tsx         # /  → Dashboard 首頁
│   │
│   ├── students/
│   │   ├── page.tsx     # 列表
│   │   ├── new/page.tsx # 新增
│   │   └── [id]/
│   │       ├── page.tsx       # 學生 360° 主頁
│   │       ├── deal/          # 成交資訊
│   │       ├── schools/       # 選校表
│   │       ├── documents/     # 文件管理
│   │       ├── applications/  # 申請追蹤
│   │       └── timeline/      # 時間軸
│   │
│   ├── deals/           # 成交總覽
│   ├── schools/         # 學校資料庫(共用)
│   ├── reports/         # 報表(主管以上)
│   └── settings/        # 設定(管理員)
│
└── api/                 # API Routes(僅當 Server Action 不適用時)
```

---

## 5. 部署架構

### 5.1 Production

| 元件 | 服務 | Region |
|---|---|---|
| Next.js 前端 | **Vercel** | Tokyo (HND1) — 距台灣最近 |
| PostgreSQL + Auth | **Supabase Cloud** | Tokyo (ap-northeast-1) |
| 檔案儲存 | **Supabase Storage** | 同上 |
| CDN | **Vercel Edge Network** | 全球 |
| DNS | Cloudflare 或 Vercel | — |

### 5.2 環境分層

```
┌────────────┬──────────────┬───────────────┬────────────────┐
│  環境       │  目的         │  Branch        │  Supabase 專案  │
├────────────┼──────────────┼───────────────┼────────────────┤
│ local      │ 本機開發      │ feature/*     │ 共用 dev       │
│ dev        │ 整合測試      │ develop       │ crm-dev        │
│ staging    │ UAT 驗收      │ staging       │ crm-staging    │
│ production │ 正式環境      │ main          │ crm-prod       │
└────────────┴──────────────┴───────────────┴────────────────┘
```

### 5.3 CI/CD

- **Vercel** 自動偵測 push 到對應 branch → 自動部署
- **Supabase migrations** 用 `supabase` CLI 在本機推送到對應專案
- PR 開啟時會自動建立 Preview Deployment(Vercel)

---

## 6. 安全策略概覽

| 風險 | 對應 |
|---|---|
| 顧問越權看別人學生 | RLS policy 在每張表強制 |
| Portal 密碼外洩 | AES-256-GCM 加密,金鑰存環境變數 |
| API key 外洩 | service_role key 僅 server-side、anon key 配 RLS |
| SQL Injection | 一律用 Supabase 客戶端參數化查詢 |
| XSS | React 預設 escape;`dangerouslySetInnerHTML` 禁用 |
| CSRF | Server Action 自帶 CSRF 防護 |
| 個資外流 | 操作軌跡 activity_log + 匯出需 admin |

詳見 [05-rls-policies.md](./05-rls-policies.md)。

---

## 7. 第三方整合(現有 + 規劃)

| 階段 | 整合 | 用途 |
|---|---|---|
| MVP | 無外部整合 | 專注核心 |
| Phase 6 | 從舊 Beta 匯入(院校庫、榜單、知識庫) | 一次性遷移 |
| Phase 7 | **Anthropic Claude API + MCP** | AI 落點分析 |
| Phase 7+ | LINE Notify(可選) | 通知(若需要) |

---

## 8. 監控與維運(MVP 後再上)

- **Vercel Analytics** — 前端效能
- **Supabase Logs** — DB / Auth 行為
- **Sentry**(規劃中)— 錯誤追蹤
- **Uptime monitor**(規劃中)— BetterStack 或 UptimeRobot

---

## 9. 架構風險與緩解

| 風險 | 緩解方案 |
|---|---|
| Supabase 服務中斷 | 每日自動備份至 S3、緊急時可遷移自架 PG |
| Vercel 流量爆 | Pro 方案 + 設定 spending limit |
| 資料庫 schema 失誤 | 所有變更走 migration 檔案、PR review |
| RLS policy 漏洞 | 寫測試覆蓋每個角色 + 啟用 Supabase audit log |
| 字數計算邏輯誤差 | DB function 為單一真相、寫單元測試覆蓋 |
