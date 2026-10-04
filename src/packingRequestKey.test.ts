import { expect, it } from 'vitest'
import { products, cartons, cushions, defaultOrderLines } from '@/data'
import { getPackingRequestKey } from '@/packingRequestKey'

const request = { products, cartons, cushions, orderLines: defaultOrderLines }
it('keeps the calculation key stable when only prices change', () => {
  expect(
    getPackingRequestKey({
      ...request,
      products: products.map((p) => ({ ...p, priceYen: 99999 })),
      cartons: cartons.map((c) => ({ ...c, priceYen: 123 })),
    }),
  ).toBe(getPackingRequestKey(request))
})
it('updates the key when physical dimensions change', () => {
  expect(
    getPackingRequestKey({
      ...request,
      products: products.map((p) => ({
        ...p,
        size: { ...p.size, height: p.size.height + 1 },
      })),
    }),
  ).not.toBe(getPackingRequestKey(request))
})
it('updates the key for wrapping, quantity and strategy changes', () => {
  for (const next of [
    { ...request, strategy: 'stable' as const },
    {
      ...request,
      orderLines: defaultOrderLines.map((l) => ({ ...l, useItemWrap: true })),
    },
    {
      ...request,
      orderLines: defaultOrderLines.map((l) => ({
        ...l,
        quantity: l.quantity + 1,
      })),
    },
  ])
    expect(getPackingRequestKey(next)).not.toBe(getPackingRequestKey(request))
})
