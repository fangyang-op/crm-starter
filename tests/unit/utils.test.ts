import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('cn — className merge (clsx + tailwind-merge)', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false, 'b', undefined, null, 'c')).toBe('a b c')
  })

  it('dedupes conflicting Tailwind utilities (last one wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
