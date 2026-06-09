# Stage 1-B 修補紀錄 — Next.js 14.2.35 → 15.5.19 升級

日期:2026-06-09
分支:`chore/nextjs-15-upgrade`(單獨執行,未與其他修補並行)
動機:14.x 線已無安全修補;2026/5 協調式安全釋出的 13 個漏洞(middleware/proxy 授權繞過、SSRF、cache poisoning、XSS、DoS)沒有 14.x 修補版,官方修補版為 15.5.18 / 16.2.6。選 **15.x**(破壞性最小、清掉全部 high)。
範圍:只處理框架升級與其連帶的程式碼修正。**未動 RLS / Storage / 金鑰**。

---

## 1. 版本變化

| 套件 | 升級前 | 升級後 |
|---|---|---|
| `next` | 14.2.35 | **15.5.19**(最新 15.5.x patch,≥15.5.18) |
| `react` | ^18 | **19.2.7** |
| `react-dom` | ^18 | **19.2.7** |
| `eslint-config-next` | 14.2.35 | **15.5.19** |
| `@types/react` | ^18 | **19.2.17** |
| `@types/react-dom` | ^18 | **19.2.3** |

> 採手動鎖定(非 `codemod upgrade latest`)以確保落在 15.5.x 而非 16;`react@^19` 解析到 19.2.7。

---

## 2. npm audit 前後對照

| 嚴重度 | 升級前(14.2.35) | 升級後(15.5.19) |
|---|---|---|
| **critical** | 0 | 0 |
| **high** | **4** | **0** ✅ |
| moderate | 1 | 2 |
| total | 5 | 2 |

- **清除的 4 個 high**:全為 Next.js 叢集(`next` / `eslint-config-next` / `@next/eslint-plugin-next` / `glob`)—— 對應 middleware/proxy 授權繞過、SSRF、cache poisoning、App Router XSS、多項 DoS。**本次升級的主要目標達成:high → 0。**
- **殘留 2 個 moderate**:皆為 `postcss <8.5.10`(CSS Stringify 的 `</style>` XSS),經由 **Next 內部 bundled 的 postcss**(`node_modules/next/node_modules/postcss`)。屬 build-time CSS 處理、非執行期可由使用者觸發;需待 Next 更新其 bundled postcss,**非本次安全目標**,可接受。(`npm audit fix --force` 會建議降到 next@9,為錯誤建議,已忽略。)

---

## 3. 已處理的破壞性變更

### 3.1 Async Request APIs(最大宗)
Next 15 將 `cookies()` / `headers()` / page&route 的 `params` / `searchParams` 改為非同步。

- **`cookies()` → `lib/supabase/server.ts`**:官方 codemod 預設留下 `UnsafeUnwrappedCookies` 同步逃生艙(會在執行期噴 deprecation 警告、且 16 會移除)。**已改為正規 async 寫法**:`createClient()` 改為 `async`,內部 `await cookies()`。
  - 連帶把**所有 server-side 呼叫端**改為 `await createClient()`:**109 個呼叫點、橫跨約 54 個檔案**(server actions / server components / route handlers)。
  - browser client(`lib/supabase/client.ts` 的 `createClient`)維持同步,**未動**(僅 `reset-password-form.tsx` 一個 'use client' 檔引用)。
  - `app/(dashboard)/students/[id]/scores/actions.ts` 的兩個 helper 參數型別 `ReturnType<typeof createClient>` → **`Awaited<ReturnType<typeof createClient>>`**(因 createClient 變 async,回傳型別變 Promise)。
- **`params` / `searchParams` → 8 個 page.tsx**:由官方 `next-async-request-api` codemod 轉為 `Promise<...>` + `await`(schools/[id]、schools、settings/users[/[id]/edit]、students[/[id]][/edit]、students/[id]/documents/[masterId][/variants/[variantId]])。已人工複查正確。
- **驗證**:`tsc --noEmit` 收斂為 0 error;dev server log **無任何「cookies() should be awaited」之類的執行期警告**(代表 async 遷移完整、無漏改)。

### 3.2 快取預設改變
- 評估結果:**專案不依賴 14 的預設快取**。理由:(a) 全部 dashboard 頁因 `cookies()`(auth)本就是 dynamic(`ƒ`),14 也不會靜態快取;(b) 程式碼**無任何** `export const dynamic/revalidate`、`unstable_cache`、`next: { revalidate }`;(c) **無 raw `fetch()`** 外部 API 呼叫(資料一律走 Supabase client);(d) 18 個檔用 `revalidatePath` 在 mutation 後刷新。
- 15 的 Client Router Cache 預設不快取只會讓**資料更新鮮**(對 CRM 有利)。**無需新增任何快取設定。**
- GET route handlers(`/auth/confirm`、`/logout`)本就 dynamic(讀 searchParams / 設 cookie / redirect),15 預設不快取為正確行為。

### 3.3 `next.config.mjs`
- 原為空 `{}`,15 仍有效。
- **新增 `outputFileTracingRoot`**(此鍵 14 在 `experimental.` 下、15 已轉正):本機家目錄 `/Users/marcus` 有一個無關的 `package-lock.json`,Next 15 的 workspace-root 推斷會誤判它為 root(build 警告)。明確把 root 釘在專案目錄,消除警告並確保 file tracing 從正確根目錄收集。

### 3.4 codemod 殘留清理 / 補型別
- 移除 codemod 的 `UnsafeUnwrappedCookies` 逃生艙(改正規 async,見 3.1)。
- 無殘留 TODO / 暫時註解(已 grep 確認)。
- codemod 在 8 個 page 留下的分號由 prettier(husky lint-staged)在 commit 時正規化為專案的 no-semi 風格。

### 3.5 已知、暫不處理(留給未來 Next 16)
- `next lint` 顯示 deprecation 警告(「will be removed in Next.js 16」)——**僅資訊性,15 仍正常運作**;遷移到 ESLint CLI 留待日後 16 升級時一併處理。

---

## 4. Build / Lint / 靜態驗證

- ✅ `npm run typecheck` — **0 error**。
- ✅ `npm run build` — 成功(26 頁全產出;`✓ Compiled successfully`;無 config / workspace-root 警告)。
- ✅ `npm run lint` — **No ESLint warnings or errors**。

---

## 5. 手動 UAT 結果

> 因無自動化測試,以本機 dev server 實測。分兩類:**(A) 我已自動驗證(不需登入憑證)** 與 **(B) 需測試帳號、待 Jo 執行**。

### (A) 已驗證 ✅
- **App 啟動**:Next 15 + React 19 dev server 正常,**無 server error、無 console error**。
- **路由保護(middleware async 改寫未破壞授權)**:未登入存取 `/`、`/students`、`/settings`、`/uat/admin`、`/duplicate-overrides`、`/schools`、`/students/new` → 全部 **307 → `/login`**;公開頁 `/login`、`/reset-password` → **200**。
- **`/auth/confirm`(無參數)** → 307 → `/reset-password?error=invalid_link`(route handler 正常)。
- **React 19 client 水合**:`/login` 互動式表單(2 inputs + 「立即登入」按鈕)正常掛載、**無 hydration error**;`/login`、`/reset-password` 畫面渲染正確(品牌視覺一致)。

### (B) 待 Jo 用測試帳號執行 ⏳(我無帳號憑證,無法登入驗證)
- 登入 / 登出、各角色(consultant / manager / admin)登入後導向正確。
- **顧問只看得到自己的學生**(RLS 仍生效,未因 async params 改寫而漏權限)——**重點**。
- 跨角色路由保護:非授權角色開 `/settings`、`/uat/admin`、`/duplicate-overrides` 應被擋(本次只驗證了「未登入」會被擋)。
- 學生建檔(含重複名單偵測)流程。
- 文件上傳 / 下載(signed URL)。
- 申請追蹤、帳密管理頁讀寫。

> ⚠️ 任一項異常先記錄、**不要硬上 production**。建議:push 本分支取得 Vercel **preview** 部署,在 preview URL 上用各角色測試帳號跑完 (B);全綠後再 merge 到 main 觸發 production。

---

## 6. 變更檔案(分支 `chore/nextjs-15-upgrade`)

- `package.json` / `package-lock.json` — 套件升級(已 commit:deps bump)
- `lib/supabase/server.ts` — `createClient` 改 async(`await cookies()`)
- ~54 個 server-side 檔 — `createClient()` → `await createClient()`(109 處)
- 8 個 page.tsx — `params` / `searchParams` 改 async(codemod)
- `app/(dashboard)/students/[id]/scores/actions.ts` — helper 型別 `Awaited<...>`
- `next.config.mjs` — 新增 `outputFileTracingRoot`
- `docs/security/stage1b-nextjs15-changelog.md` — 本紀錄

---

## 7. 金鑰輪替(備註)
官方對 React2Shell 的「升級後輪替 secret」建議,主要針對曾跑在易受攻擊版本(14.3 canary / 15 / 16 未修補版)的環境。本專案原為 **14.2.35 stable**,非該漏洞影響範圍,故本次升級**不強制輪替 Supabase 金鑰**(除非資訊部另有要求)。
