# CRM 系統修改規格 v1.3

> **目的**：登入頁面視覺改版 + 系統名稱更名，共 2 項。
> **執行原則**：同前（每項獨立 commit、不確定自行判斷）
> **前置確認**：先 `git pull` 確認在 v1.2 最新 commit 後再開始。

---

## 1. 登入頁面改版

**位置**：`app/(auth)/login/page.tsx`（或 `app/login/page.tsx`）

**目標樣式**：對照使用者截圖，完整複刻以下設計。

### 1.1 整體背景
```css
background: linear-gradient(135deg, #EEF2FF 0%, #F9FAFB 50%, #FFF0F3 100%);
/* 左上偏藍紫、右下偏淡粉，柔和漸層 */
min-height: 100vh;
display: flex; align-items: center; justify-content: center;
```

### 1.2 頂部色條
登入卡片頂部有一條品牌色漸層色條：
```css
height: 5px;
background: linear-gradient(90deg, #C7315C, #FF6B8A);
border-radius: 12px 12px 0 0;
```

### 1.3 Logo 圖示
- 圓角正方形背景（`#FFF0F3`，border-radius 16px）
- 內部放 lucide `ShieldCheck` icon，顏色 `#C7315C`
- 大小：外框 64×64px，icon 32px
- 位置：卡片上方置中，與卡片稍微重疊（`margin-bottom: -32px; position: relative; z-index: 1`）

### 1.4 標題文字
```
放洋留遊學 CRM 全端平台      ← 主標，font-size: 1.4rem, font-weight: 700, color: #111827
顧問資訊整合中心 · 內部員工登入  ← 副標，font-size: 0.82rem, color: #6B7280
```
> ASSUMPTION：截圖中「留遊學」應為「留學」，實際文字以品牌正式名稱為準。
> → 標題統一使用「放洋留學 CRM 全端平台」

### 1.5 登入卡片
```css
background: #FFFFFF;
border-radius: 16px;
padding: 2.5rem 2rem 2rem;
box-shadow: 0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
width: 420px;
```

### 1.6 表單欄位
- **欄位一**：員工編號 Employee ID（label 中英並列）
- **欄位二**：登入密碼 Password（label 中英並列）
- 輸入框樣式：
  ```css
  background: #F3F4F6;
  border: none;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  ```
  focus 時：`box-shadow: 0 0 0 2px #C7315C40`（無 border，只有 glow）

### 1.7 登入按鈕
```css
background: #1F2937;   /* 深墨色，與截圖一致 */
color: white;
border-radius: 10px;
padding: 0.8rem;
font-size: 0.9rem; font-weight: 600;
width: 100%;
```
按鈕文字：`→ 立即登入`（使用 lucide `LogIn` icon）
hover：`background: #111827`

### 1.8 底部提示文字
```
初次登入請使用員工編號作為密碼，登入後可於設定區修改。
font-size: 0.72rem; color: #9CA3AF; text-align: center;
```

### 1.9 頁面底部版權
```
© 2026 FangYang International Education Group
font-size: 0.72rem; color: #9CA3AF;
position: fixed; bottom: 1.5rem;
```

### 1.10 登入邏輯
- **不更動**既有 Supabase Auth 邏輯
- 只改視覺，`onSubmit` handler 維持原本的 `signInWithPassword` 流程
- 錯誤訊息樣式更新：紅色 inline alert，放在按鈕上方

**驗收**：
- [ ] 背景漸層正確（左上藍紫 → 右下淡粉）
- [ ] 卡片頂部有品牌色條
- [ ] ShieldCheck icon 居中於卡片上方
- [ ] 標題「放洋留學 CRM 全端平台」+ 副標
- [ ] 輸入框無 border、灰底、focus 有 glow
- [ ] 登入按鈕深墨色
- [ ] 版權文字固定在底部
- [ ] 登入功能（Auth 邏輯）維持正常
- [ ] 完成後 commit：`feat: [1] 登入頁面視覺改版`

---

## 2. 系統名稱更名

**更名內容**：
- 舊名：`留學代辦 CRM`
- 新名：`放洋全端 CRM 平台`

**需要修改的位置**（grep `留學代辦` 全專案後逐一替換）：

| 位置 | 說明 |
|---|---|
| `components/layout/sidebar.tsx` | 左側功能列頂部 Logo 文字 |
| `app/layout.tsx` 或 `app/(dashboard)/layout.tsx` | `<title>` metadata |
| `app/(auth)/login/page.tsx` | 登入頁主標題（連動第 1 項） |
| `public/` 任何 manifest / SEO 相關檔案 | `name`、`short_name`、`description` |
| 其他任何出現「留學代辦 CRM」的地方 | 全部替換 |

**Sidebar Logo 區域最終文字**：
```
放洋全端 CRM 平台     ← 主標（font-weight: 700）
顧問資訊整合中心      ← 副標（font-size: 0.7rem, color: var(--ink-3)）
```

**驗收**：
- [ ] Sidebar 左上角顯示「放洋全端 CRM 平台」
- [ ] 瀏覽器分頁標題更新
- [ ] 登入頁標題連動（第 1 項已處理）
- [ ] grep `留學代辦` 無結果
- [ ] 完成後 commit：`feat: [2] 系統名稱更名為放洋全端 CRM 平台`

---

## 3. 完成後部署

兩項都完成並 commit 後，執行：

```bash
git push origin main
```

Vercel 會自動偵測 push 並觸發部署（約 1–3 分鐘）。

部署完成後確認：
- [ ] Production URL 登入頁顯示新版視覺
- [ ] Sidebar 名稱正確
- [ ] 功能正常（可登入、可進入 Dashboard）

---

## 驗收清單（全部完成後）

- [ ] 登入頁：漸層背景 + 品牌色條 + ShieldCheck icon + 深墨色按鈕
- [ ] 登入功能正常（Auth 邏輯未受影響）
- [ ] Sidebar 頂部：「放洋全端 CRM 平台」
- [ ] 瀏覽器標題更新
- [ ] grep `留學代辦` 無結果
- [ ] `git push` 完成，Vercel 部署成功
