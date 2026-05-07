/**
 * 正規化台灣手機 / 市話號碼。
 * 1. 去除所有空格、破折號、括號等非數字字元
 * 2. 開頭 +8869 → 09 (手機)
 * 3. 開頭 +886  → 0  (市話、其他類型)
 *
 * 若輸入為空或 null,回傳空字串(由呼叫端決定要不要再轉成 null 寫入 DB)。
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''

  let phone = raw.trim()

  // +8869xxxxxxxx → 09xxxxxxxx (手機)
  phone = phone.replace(/^\+8869/, '09')

  // +886x → 0x (市話、其他)。順序很重要 — +8869 先處理才不會被這條吃掉。
  phone = phone.replace(/^\+886/, '0')

  // 把所有非數字砍掉(空格、破折號、括號、+號等)。
  phone = phone.replace(/\D/g, '')

  return phone
}

/**
 * 正規化後驗證:
 *   手機 09xxxxxxxx (10 碼)
 *   市話 0[2-9]xxxxxxx 或 0[2-9]xxxxxxxx (9-10 碼)
 *
 * 注意:正規化後才呼叫 — 帶分隔符的字串會 false。
 */
export function isValidTaiwanPhone(normalized: string): boolean {
  return /^09\d{8}$/.test(normalized) || /^0[2-9]\d{7,8}$/.test(normalized)
}
