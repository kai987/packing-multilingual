export const PRODUCT_QUANTITY_MAX_DIGITS = 3
export const PRODUCT_DIMENSION_MAX_DIGITS = 3
export const PRODUCT_PRICE_MAX_DIGITS = 6

export function sanitizeDigitsInput(
  rawValue: string,
  maxDigits: number,
): string {
  return rawValue
    .replace(/[\uFF10-\uFF19]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .replace(/\D/g, '')
    .slice(0, maxDigits)
}

export function parseProductDimension(rawValue: string): number | null {
  if (!/^\d{1,3}$/.test(rawValue)) return null
  const value = Number(rawValue)
  return value >= 1 && value <= 999 ? value : null
}
