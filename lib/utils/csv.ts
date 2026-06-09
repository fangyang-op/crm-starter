/**
 * CSV 儲存格安全輸出(Stage 2-B / 資安 §2.5)。
 *
 * 兩道處理,順序很重要:
 *   1. formula / CSV injection 中和:值的「首字元」若為 `= + - @`、Tab(\t)、
 *      CR(\r),前置單引號 `'`,讓 Excel / Google Sheets 開啟時當作字面文字而非
 *      公式執行(否則 `=cmd|...`、`@SUM(...)` 可能被執行)。刻意檢查原始首字元
 *      (不 trim),才能同時擋住以 Tab / CR 開頭的儲存格。
 *   2. 標準 CSV escaping:值含逗號 / 雙引號 / 換行 → 以雙引號包覆,內部雙引號
 *      加倍。先中和再包覆,單引號才會落在引號內、成為儲存格的字面開頭。
 *
 * 所有 CSV 匯出的每一個儲存格(含表頭)都應經過此函式。
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '')
  // 1) formula-injection 中和(以可觸發公式解析的字元開頭)。
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  // 2) 標準 CSV 跳脫。
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
