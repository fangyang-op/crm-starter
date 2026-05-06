import { diffWords } from 'diff'

/**
 * Word counting per docs/08 §2.3:
 *   - 中文按字計(每個 CJK Unified Ideographs 字元 = 1)
 *   - 英文按詞計(連續字母序列 = 1 詞)
 *   - 標點 / 空白 / 數字不計
 *
 * Total = chineseChars + englishWords.
 */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return chineseChars + englishWords
}

export type WordDiff = {
  prevCount: number
  currentCount: number
  /** Sum of words in added + removed segments — what the student gets billed for. */
  wordsChanged: number
}

/**
 * Calculate the per-version word delta. Per docs/08 §2.4 we use plan A:
 * "扣動到的字數" — the sum of words across added AND removed segments,
 * not abs(currentCount - prevCount). This prevents the "swap-equivalent
 * blocks" loophole.
 */
export function calculateWordDiff(
  prev: string | null | undefined,
  current: string | null | undefined,
): WordDiff {
  const prevText = prev ?? ''
  const currentText = current ?? ''

  const prevCount = countWords(prevText)
  const currentCount = countWords(currentText)

  const changes = diffWords(prevText, currentText)
  let wordsChanged = 0
  for (const part of changes) {
    if (part.added || part.removed) {
      wordsChanged += countWords(part.value)
    }
  }

  return { prevCount, currentCount, wordsChanged }
}
