import { bench, describe, expect } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans, type PackingRequest } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import { loadRustCalculator } from '@/testUtils/loadPackingWasm'

const rust = await loadRustCalculator()
for (const [name, orderLines] of [
  ['default 7 items', defaultOrderLines],
  ['mixed 14 items', defaultOrderLines.map((l) => ({ ...l, quantity: 2 }))],
] as const) {
  const request: PackingRequest = {
    products,
    cartons,
    cushions,
    orderLines: [...orderLines],
  }
  expect(rust(request, 3)).toEqual(
    getVisiblePackingPlans(recommendPackingPlans(request)),
  )
  describe(`${name} (warm engine, includes WASM JSON bridge)`, () => {
    bench(
      'TypeScript',
      () => {
        getVisiblePackingPlans(recommendPackingPlans(request))
      },
      { time: 1500, warmupTime: 400, iterations: 20 },
    )
    bench(
      'Rust/WASM',
      () => {
        rust(request, 3)
      },
      { time: 1500, warmupTime: 400, iterations: 20 },
    )
  })
}
