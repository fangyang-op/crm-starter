import { z } from 'zod'

// Password rules per spec § 0.4: 至少 8 字、含大小寫 + 數字
//
// Intentionally NOT requiring symbols — too restrictive for a small
// internal tool, and makes random-generated passwords harder to read aloud
// to users over a phone call.

const passwordRule = z
  .string()
  .min(8, '密碼至少 8 個字元')
  .max(128, '密碼最長 128 字')
  .regex(/[a-z]/, '密碼需含小寫字母')
  .regex(/[A-Z]/, '密碼需含大寫字母')
  .regex(/\d/, '密碼需含數字')

export const changeOwnPasswordSchema = z
  .object({
    current_password: z.string().min(1, '請輸入目前密碼'),
    new_password: passwordRule,
    confirm_password: z.string().min(1, '請再次輸入新密碼'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: '兩次輸入的新密碼不一致',
  })
  .refine((d) => d.current_password !== d.new_password, {
    path: ['new_password'],
    message: '新密碼不可與目前密碼相同',
  })

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>

export const adminResetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: passwordRule,
})

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>

/**
 * 回傳無偏(uniform)的 [0, maxExclusive) 整數。
 *
 * 以 `crypto.getRandomValues()` 取足夠位元組,並用 rejection sampling 丟棄
 * 落在偏差區間的值,避免直接 `byte % n` 造成的 modulo bias。對任意
 * maxExclusive ≥ 1 皆正確(會依範圍取用 1+ 個位元組),不會無限迴圈。
 */
function randomBelow(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new RangeError('randomBelow: maxExclusive must be a positive integer')
  }
  const bytesNeeded = Math.max(1, Math.ceil(Math.log2(maxExclusive) / 8))
  const maxValue = 256 ** bytesNeeded // 可表示的位元組組合總數
  const maxValid = Math.floor(maxValue / maxExclusive) * maxExclusive // 無偏接受門檻
  const buf = new Uint8Array(bytesNeeded)
  for (;;) {
    crypto.getRandomValues(buf)
    let value = 0
    for (let k = 0; k < buf.length; k++) value = value * 256 + buf[k]
    if (value < maxValid) return value % maxExclusive
  }
}

/**
 * 產生安全隨機初始密碼,供後台「建立使用者 / 重設密碼」一鍵帶入。
 *
 * 安全性:使用 Web Crypto 的 `crypto.getRandomValues()`(CSPRNG)透過
 * `randomBelow()` 做無偏取樣(rejection sampling,避免 modulo bias)。全域
 * `crypto` 在瀏覽器與 Node 18.17+ 皆可用 — 本檔會被 'use client' 表單引用,
 * 故刻意使用「全域 crypto」而非 `node:crypto`(後者無法進 client bundle)。
 *
 * 相容性:保證輸出至少含一個大寫、一個小寫、一個數字,以滿足
 * `passwordRule` / `createUserSchema` 的密碼規則(大小寫 + 數字),避免產生的
 * 密碼反被伺服器端 zod 驗證擋下。字元集排除易混淆字元(0/O、1/l/I、i、o),
 * 並依專案既有設計不含符號(方便電話口述)。新增的 `length` 參數有預設值,
 * 既有呼叫端 `generateRandomPassword()` 不受影響。
 */
export function generateRandomPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // 排除 I, O
  const lower = 'abcdefghjkmnpqrstuvwxyz' // 排除 i, l, o
  const digits = '23456789' // 排除 0, 1
  const all = upper + lower + digits

  const pick = (set: string): string => set.charAt(randomBelow(set.length))

  // 先放 3 個「保證字元」滿足密碼規則(大小寫 + 數字),其餘以全字集填滿。
  const required = [pick(upper), pick(lower), pick(digits)]
  const targetLength = Math.max(length, required.length)
  const filler = Array.from({ length: targetLength - required.length }, () => pick(all))
  const chars = [...required, ...filler]

  // 加密級 Fisher–Yates 洗牌,讓保證字元不會固定落在前三位。
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
