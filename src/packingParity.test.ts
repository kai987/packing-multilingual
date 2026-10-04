import { describe, expect, it } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans, type PackingRequest } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import { loadRustCalculator } from '@/testUtils/loadPackingWasm'

const rust = await loadRustCalculator()
const base: PackingRequest = {
  products,
  cartons,
  cushions,
  orderLines: defaultOrderLines,
}
let seed = 20261004
const random = (max: number) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed % max
}
const scenarios: Array<{ name: string; request: PackingRequest }> = [
  { name: 'default compact order', request: base },
  { name: 'default stable order', request: { ...base, strategy: 'stable' } },
  {
    name: 'all individual wrapping',
    request: {
      ...base,
      orderLines: defaultOrderLines.map((l) => ({ ...l, useItemWrap: true })),
    },
  },
  {
    name: 'zero quantities',
    request: {
      ...base,
      orderLines: defaultOrderLines.map((l) => ({ ...l, quantity: 0 })),
    },
  },
  {
    name: 'heuristic partitions above twelve items',
    request: {
      ...base,
      orderLines: defaultOrderLines.map((l) => ({ ...l, quantity: 2 })),
    },
  },
  {
    name: 'fractional measured dimensions',
    request: {
      ...base,
      products: products.map((p) => ({
        ...p,
        size: {
          ...p.size,
          length: p.size.length + 0.25,
          width: p.size.width + 0.5,
        },
      })),
    },
  },
]
for (let index = 0; index < 20; index++) {
  const sample = products
    .slice(0, 3)
    .map((p, i) => ({
      ...p,
      id: ['A-10', 'a:2', '商品🧱'][i],
      size: {
        length: 20 + random(100),
        width: 20 + random(100),
        height: 20 + random(100),
      },
      weight: 10 + random(800),
      fragility: (['low', 'medium', 'high'] as const)[random(3)],
    }))
  scenarios.push({
    name: `seeded mixed order ${index}`,
    request: {
      ...base,
      products: sample,
      cartons: cartons.slice(0, 4),
      strategy: index % 2 === 0 ? 'compact' : 'stable',
      maxLayers: 3,
      orderLines: sample.map((p) => ({
        productId: p.id,
        quantity: random(4),
        useItemWrap: random(2) === 1,
      })),
    },
  })
}

describe('TypeScript / real WASM differential regression', () => {
  it.each(scenarios)(
    '$name',
    ({ request }) => {
      const expected = recommendPackingPlans(request)
      expect(rust(request)).toEqual(expected)
      expect(rust(request, 3)).toEqual(getVisiblePackingPlans(expected))
    },
    20_000,
  )
})
