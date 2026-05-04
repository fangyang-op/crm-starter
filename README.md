# 留學代辦 CRM 系統

> 一套以「學生即專案」為核心的留學代辦內部營運系統。

---

## 📖 文件導覽

請依以下順序閱讀,理解本專案的全貌:

1. **[CLAUDE.md](./CLAUDE.md)** — Claude Code 工作指引(開發者必讀)
2. **[docs/01-prd.md](./docs/01-prd.md)** — 產品需求文件
3. **[docs/02-architecture.md](./docs/02-architecture.md)** — 技術架構與選型決策
4. **[docs/03-database-schema.md](./docs/03-database-schema.md)** — 資料庫 Schema 完整文件
5. **[docs/04-roadmap.md](./docs/04-roadmap.md)** — 開發路線圖(Phase 0-7)
6. **[docs/05-rls-policies.md](./docs/05-rls-policies.md)** — 權限策略
7. **[docs/06-erd.svg](./docs/06-erd.svg)** — 資料庫 ER 視覺圖
8. **[docs/07-design-system.md](./docs/07-design-system.md)** — UI 設計系統
9. **[docs/08-business-logic.md](./docs/08-business-logic.md)** — 核心業務邏輯

---

## 🚀 快速開始

### 1. 環境準備

```bash
# 安裝依賴
npm install

# 複製環境變數
cp .env.example .env.local
# → 填入 Supabase URL / anon key / service role key
```

### 2. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 開新專案
2. 取得 Project URL 與 API keys → 填入 `.env.local`
3. 執行第一份 migration:
   ```bash
   # 把 supabase/migrations/0001_init.sql 內容
   # 貼進 Supabase Dashboard 的 SQL Editor 執行
   ```

### 3. 啟動本機開發

```bash
npm run dev
# → 開啟 http://localhost:3000
```

---

## 🧱 專案技術棧

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- 部署:**Vercel** + Supabase Cloud

---

## 👥 使用者角色

| 角色 | 權限範圍 |
|---|---|
| 顧問(Consultant) | 只能看自己負責的學生 |
| 前端主管(Manager - Frontend) | 看全部學生,招生決策 |
| 後端主管(Manager - Backend) | 看全部學生,行政決策 |
| 老闆(Admin) | 全部權限,含營收/系統設定 |

---

## 🏗 開發狀態

請見 [docs/04-roadmap.md](./docs/04-roadmap.md)。目前處於 **Phase 0:基礎建設**。
