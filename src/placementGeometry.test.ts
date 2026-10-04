import { expect, it } from 'vitest'
import { getPlacementGeometry } from '@/placementGeometry'

it('preserves the unwrapped product dimensions', () => {
  const size = { length: 70, width: 70, height: 150 }
  expect(getPlacementGeometry({ ...size, productSize: size })).toEqual({
    product: size,
    inset: { length: 0, width: 0, height: 0 },
  })
})
it('draws wrapping outside the real product without shrinking it', () => {
  const product = { length: 70, width: 70, height: 150 }
  expect(
    getPlacementGeometry({
      length: 80,
      width: 80,
      height: 160,
      productSize: product,
    }),
  ).toEqual({ product, inset: { length: 5, width: 5, height: 5 } })
})
it('uses the rotated product axes returned by the core', () => {
  const product = { length: 82, width: 128, height: 150 }
  expect(
    getPlacementGeometry({
      length: 102,
      width: 148,
      height: 170,
      productSize: product,
    }),
  ).toEqual({ product, inset: { length: 10, width: 10, height: 10 } })
})
