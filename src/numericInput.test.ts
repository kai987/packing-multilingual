import { describe, expect, it } from 'vitest'
import { parseProductDimension, sanitizeDigitsInput } from '@/numericInput'

describe('numeric input', () => {
  it('retains empty draft input and enforces digit limits', () => {
    expect(sanitizeDigitsInput('', 3)).toBe('')
    expect(sanitizeDigitsInput('12x345', 3)).toBe('123')
    expect(sanitizeDigitsInput('1234567', 6)).toBe('123456')
    expect(sanitizeDigitsInput('\uFF11\uFF12\uFF13', 3)).toBe('123')
  })
  it.each(['', '0', '-1', '1.5', '1000', 'abc'])(
    'does not commit invalid dimension "%s"',
    (value) => {
      expect(parseProductDimension(value)).toBeNull()
    },
  )
  it('accepts dimensions at both boundaries', () => {
    expect(parseProductDimension('1')).toBe(1)
    expect(parseProductDimension('999')).toBe(999)
  })
})
