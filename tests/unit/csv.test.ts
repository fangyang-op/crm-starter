import { describe, expect, it } from 'vitest'

import { csvCell } from '@/lib/utils/csv'

describe('csvCell — formula / CSV injection neutralization', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['-2+3', "'-2+3"],
    ['+1', "'+1"],
  ])('prefixes a single-quote when a cell starts with a formula trigger: %s', (input, expected) => {
    expect(csvCell(input)).toBe(expected)
  })

  it('neutralizes a leading Tab', () => {
    expect(csvCell('\tcmd')).toBe("'\tcmd")
  })

  it('neutralizes a leading CR (also wrapped, since CR is in the escape set)', () => {
    const cr = '\r'
    expect(csvCell(cr + 'cmd')).toBe('"\'' + cr + 'cmd"')
  })

  it('leaves normal values unchanged', () => {
    expect(csvCell('hello')).toBe('hello')
    expect(csvCell('02 5580 2586')).toBe('02 5580 2586')
    expect(csvCell('學生姓名')).toBe('學生姓名')
    expect(csvCell(42)).toBe('42')
  })

  it('wraps values containing comma / quote / newline', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('neutralizes AND escapes a formula that also contains a comma/quote', () => {
    expect(csvCell('=cmd,"x"')).toBe('"\'=cmd,""x"""')
  })

  it('coerces null / undefined to empty string', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
})
