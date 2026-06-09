# 補「重設密碼頁面」(/reset-password) — 修補紀錄

日期:2026-06-09
背景:忘記密碼 → 收信 → 點連結原本掉回登入頁(App 沒有頁面接住 Supabase recovery token)。本次補上 `/reset-password` 與其 callback handler,讓使用者完成「輸入新密碼」。非救火(admin 已用 SQL 救回),屬功能缺口補齊。
範圍限制:未動 RLS / Storage / 金鑰;樣式沿用登入頁(Shield 品牌版)。**未與 Next.js 15 升級並行**(那支另開)。

---

## 新增 / 修改檔案

| 檔案 | 動作 | 說明 |
|---|---|---|
| `app/auth/confirm/route.ts` | 新增 | `/auth/confirm` route handler — 接 recovery 連結,建立暫時 session 後導向 `/reset-password` |
| `app/(auth)/reset-password/page.tsx` | 新增 | `/reset-password` 頁(server component,套用 `(auth)` 群組的漸層 layout,與登入頁同視覺) |
| `app/(auth)/reset-password/reset-password-form.tsx` | 新增 | 'use client' 表單:偵測 recovery session、新密碼表單、錯誤/邊界處理 |
| `lib/supabase/middleware.ts` | 修改 | 公開白名單加入 `/reset-password` 與 `/auth/*` |
| `lib/validators/auth.ts` | 修改 | 新增 `resetPasswordSchema`(沿用既有 `passwordRule`) |
| `.claude/launch.json` | 新增(**local-only,已被 .gitignore 排除,不會 commit**) | 本機 preview 用的 dev server 設定 |

---

## 採用的 token 流程

專案使用 **`@supabase/ssr`**(cookie-based,PKCE-capable)。為了不被 Dashboard email 樣板的設定方式綁死,實作對三種流程**都相容**:

1. **PKCE `code` 流程**(`?code=...`):`/auth/confirm` 呼叫 `exchangeCodeForSession(code)`。
2. **`token_hash` 流程**(`?token_hash=...&type=recovery`):`/auth/confirm` 呼叫 `verifyOtp({ type, token_hash })`。
3. **hash / implicit 流程**(`#access_token=...&type=recovery`):由 `/reset-password` 的 browser client(`@supabase/ssr` `createBrowserClient`,預設 `detectSessionInUrl`)解析 hash 並觸發 `PASSWORD_RECOVERY` 事件。

- `/auth/confirm` 成功後把 session 寫入 cookie 並 `redirect` 到 `?next`(預設 `/reset-password`);失敗則 `redirect` 到 `/reset-password?error=<code>`(由頁面顯示友善訊息,**不掉回登入頁、不白畫面**)。`next` 只允許站內相對路徑(防 open redirect)。
- `/reset-password` 頁無論哪種流程,進入時都會確認 supabase client 已持有可呼叫 `updateUser` 的 recovery session(`getSession()` 命中 cookie session,或監聽 `onAuthStateChange` 的 `PASSWORD_RECOVERY`/`SIGNED_IN`)。

---

## 公開白名單調整(`lib/supabase/middleware.ts`)

原本 `isPublic = /login、/login/*、/logout`。新增:

```ts
path === '/reset-password' ||   // 訪客此時只有 recovery session(或沒有),不能被踢回 /login
path.startsWith('/auth/')       // /auth/confirm 在 session 建立「之前」就被命中,必須公開
```

- 重要:`/reset-password` **沒有**被加進「已登入就 redirect 回 /」那條規則(該規則只針對 `/login`),所以帶 recovery session 的使用者能正常進到此頁。

---

## 重設密碼表單

- 欄位:**新密碼 + 確認新密碼**(各含顯示/隱藏切換)+ 送出。
- 前端驗證:**沿用 `passwordRule`**(經由新增的 `resetPasswordSchema`)→ 長度 8–128、含大小寫 + 數字、兩次需相符。與後台改密碼 / admin 重設一致。
- 送出:client 端 `supabase.auth.updateUser({ password })`(recovery session 在瀏覽器端,client-side 呼叫對三種流程都成立)。
- **成功**:`signOut()` 清掉暫時的 recovery session → 顯示成功訊息 → 自動導回**登入頁 `/login`**,請使用者用新密碼登入。
  > 設計說明:task 寫「導回登入頁(`/`)」,但本專案登入頁實際在 `/login`(`/` 是已登入的 dashboard)。若不先 `signOut`,middleware 會因為仍有 session 把 `/login` 轉到 `/`(dashboard)。因此採「先 signOut→ 導 `/login`」,完全符合驗收步驟「回登入頁 → 新密碼可登入」。

---

## 錯誤與邊界處理(涵蓋情境)

| 情境 | 行為 |
|---|---|
| token 過期 / 無效(`otp_expired`、`access_denied` 等;URL query 或 hash 帶 error) | 顯示「此重設連結已失效或過期,請重新申請密碼重設。」+ 返回登入頁連結 |
| 直接造訪 `/reset-password`(無 recovery session) | 撐過偵測視窗後顯示「連結無效或已過期。請從『忘記密碼』信件中的連結重新進入…」+ 返回登入頁連結 |
| `updateUser` 失敗(session 中途過期等) | 顯示「密碼更新失敗,此重設連結可能已過期。請重新申請密碼重設。」 |
| 偵測中 | 顯示「驗證重設連結中…」spinner,**不白畫面、不 silent redirect、不崩潰** |

- 所有訊息皆為可讀中文;每個錯誤態都有「返回登入頁」出口。

---

## ⚠️ 預期進入路徑(需 Jo 在 Supabase Dashboard 確認)

「Send password recovery」信是以 **Site URL** 為 redirect 基準(背景已說 Site URL / Redirect URLs 已修正為正式網址)。要讓連結確實落在 `/reset-password`,**二選一**:

- **(建議)** 客製 Reset Password email 樣板,把確認連結指向 `/auth/confirm`,並帶 `next`:
  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
  ```
  → 走 `verifyOtp` 流程,最穩定(@supabase/ssr 官方建議的 server-side 模式)。
- **或** 沿用預設 `{{ .ConfirmationURL }}`(PKCE):確認後會帶 `?code=...` 回到 redirect 目標;只要該 redirect 落在 `/auth/confirm`(或 Redirect URLs 允許 `/auth/confirm`),handler 會 `exchangeCodeForSession` 後轉進 `/reset-password`。

> 本頁**預期從 `/auth/confirm` 進入**(成功後內部轉到 `/reset-password`);若 email 樣板直接指向 `/reset-password#access_token=...`,前端的 hash 偵測也接得住。請 Jo 在 Dashboard 對應確認 email 樣板 redirect 與 Redirect URLs 白名單包含 `/auth/confirm` 與 `/reset-password`。

> ⚠️ 測試提醒:Supabase 內建 email 有**寄信頻率上限**,短時間連續寄 recovery 會被擋,需間隔。

---

## 驗證結果

- ✅ `npm run typecheck` / `npm run lint` / `npm run build` 全通過;`/reset-password` 與 `/auth/confirm` 都出現在 build route manifest。
- ✅ **手動(本機 dev server 實測)— 直接造訪 `/reset-password`(無 token)**:
  - HTTP **200**(非 307 轉回 `/login`)→ 公開白名單生效,未被 middleware 擋掉。
  - SSR 先渲染「驗證重設連結中…」;client 偵測無 session 後轉為「**連結無效或已過期**」友善訊息 + 返回登入頁按鈕。
  - **console error 數 = 0**(不崩潰);視覺與登入頁一致(漸層底 + Shield 品牌 tile + 品牌色條 + 白卡 + 版權)。
- ⏳ **待 Jo(email 額度恢復後)**:用測試帳號寄 recovery → 點連結 → 應落在 `/reset-password` → 輸入新密碼 → 成功 → 回登入頁 → 新密碼可登入。

---

## 移交文件

- §11「補重設密碼頁面」該列 → 可改 ✅(本頁完成;Dashboard email 樣板確認後即端到端可用)。
- 附錄 C.4 不受影響。

---

## 變更檔案清單(供 commit 參考,本次未自動 commit)

```
新增  app/auth/confirm/route.ts
新增  app/(auth)/reset-password/page.tsx
新增  app/(auth)/reset-password/reset-password-form.tsx
修改  lib/supabase/middleware.ts
修改  lib/validators/auth.ts
新增  docs/security/stage-reset-password-changelog.md
(local-only,不入版控) .claude/launch.json
```
