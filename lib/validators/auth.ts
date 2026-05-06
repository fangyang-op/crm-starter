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

/** Cryptographically-random password the admin UI can drop into the field
 *  with one click. 12 chars, includes upper/lower/digit. */
export function generateRandomPassword(): string {
  // browser-safe: use crypto.getRandomValues; this is shared between
  // server actions and (in theory) any client-side generator
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // exclude I, O for readability
  const lower = 'abcdefghjkmnpqrstuvwxyz' // exclude i, l, o
  const digits = '23456789' // exclude 0, 1
  const all = upper + lower + digits

  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ]
  const filler = Array.from({ length: 9 }, () => all[Math.floor(Math.random() * all.length)])
  const arr = [...required, ...filler]
  // Fisher–Yates shuffle so the required slots aren't always at the front
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}
