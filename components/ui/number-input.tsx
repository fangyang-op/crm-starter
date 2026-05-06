'use client'

import { forwardRef } from 'react'

import { Input } from '@/components/ui/input'

// Spec § 0.2 / 0.3:
//
// - Default value of "0" / 0 must render as empty (so the placeholder shows
//   "0" instead of literal 0). Users typing "4000" must NOT see "04000".
// - Use type="text" + inputMode so we don't get the browser's native
//   number spinner arrows or its quirky validation.
// - Only allow digits (and one decimal point when `decimal` is on).
// - Strip leading zeros automatically except for the bare "0." case while
//   typing a decimal.
//
// API:
//
//   value:           string | number | null | undefined  (controlled)
//   onValueChange:   (next: string) => void
//   decimal:         allow a decimal point, default true
//   blankOnZero:     when value is "0"/"0.00"/0, show empty instead of "0",
//                    default true. Set false when 0 is a meaningful display
//                    value (rare).
//
// Callers that previously did `onChange={(e) => setX(e.target.value)}`
// switch to `onValueChange={setX}` — slightly cleaner and removes the need
// to handle the SyntheticEvent here.

type BaseInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'pattern' | 'value' | 'onChange' | 'defaultValue'
>

export type NumberInputProps = BaseInputProps & {
  value: string | number | null | undefined
  onValueChange: (value: string) => void
  decimal?: boolean
  blankOnZero?: boolean
}

const ZERO_DISPLAYS = new Set(['0', '0.', '0.0', '0.00', '0.000'])

function isZeroish(s: string): boolean {
  if (ZERO_DISPLAYS.has(s)) return true
  // Tolerate "00", "000", etc. (shouldn't really happen because we strip,
  // but be defensive on initial mount with weird input).
  if (/^0+(\.0*)?$/.test(s)) return true
  return false
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, decimal = true, blankOnZero = true, ...rest },
  ref,
) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  const display = blankOnZero && isZeroish(stringValue) ? '' : stringValue

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    let raw = e.target.value

    // Drop everything that isn't a digit (or, in decimal mode, a dot).
    const filterPattern = decimal ? /[^\d.]/g : /\D/g
    raw = raw.replace(filterPattern, '')

    // Collapse multiple dots to one.
    if (decimal) {
      const idx = raw.indexOf('.')
      if (idx >= 0) {
        raw = raw.slice(0, idx + 1) + raw.slice(idx + 1).replace(/\./g, '')
      }
    }

    // Strip leading zeros, but keep "0." so users can type "0.5" naturally.
    if (raw.length > 1 && raw[0] === '0' && raw[1] !== '.') {
      raw = raw.replace(/^0+/, '') || '0'
    }

    onValueChange(raw)
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      {...rest}
    />
  )
})
