import { describe, expect, it } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import {
  recommendPackingPlans as recommendTypeScriptPlans,
  recommendPacking as recommendTypeScriptSingle,
  LAYER_SEPARATOR_HEIGHT,
  type PackedPlacement,
  type Product,
  type PackingRequest,
} from '@/packing'
import { loadRustCalculator } from '@/testUtils/loadPackingWasm'

const EPSILON = 0.000_001

function placementsOverlap(left: PackedPlacement, right: PackedPlacement) {
  return (
    left.x < right.x + right.length - EPSILON &&
    right.x < left.x + left.length - EPSILON &&
    left.y < right.y + right.width - EPSILON &&
    right.y < left.y + left.width - EPSILON &&
    left.z < right.z + right.height - EPSILON &&
    right.z < left.z + left.height - EPSILON
  )
}

function positiveOrderQuantities() {
  return new Map(
    defaultOrderLines
      .filter((line) => line.quantity > 0)
      .map((line) => [line.productId, line.quantity]),
  )
}

const rustCalculator = await loadRustCalculator()
for (const engine of [
  {
    name: 'TypeScript',
    plans: recommendTypeScriptPlans,
    single: recommendTypeScriptSingle,
  },
  {
    name: 'Rust/WASM',
    plans: rustCalculator,
    single: (request: PackingRequest) => rustCalculator(request).single,
  },
]) {
  const recommendPackingPlans = engine.plans
  const recommendPacking = engine.single
  describe(`${engine.name}: recommendPackingPlans`, () => {
    it('keeps every placement inside the selected carton without overlap', () => {
      const { single } = recommendPackingPlans({
        products,
        cartons,
        cushions,
        orderLines: defaultOrderLines,
      })
      const recommendation = single[0]
      const expectedQuantity = defaultOrderLines.reduce(
        (sum, line) => sum + line.quantity,
        0,
      )

      expect(recommendation).toBeDefined()
      expect(recommendation.placements).toHaveLength(expectedQuantity)

      for (const placement of recommendation.placements) {
        expect(placement.x).toBeGreaterThanOrEqual(0)
        expect(placement.y).toBeGreaterThanOrEqual(0)
        expect(placement.z).toBeGreaterThanOrEqual(0)
        expect(placement.x + placement.length).toBeLessThanOrEqual(
          recommendation.effectiveInner.length + EPSILON,
        )
        expect(placement.y + placement.width).toBeLessThanOrEqual(
          recommendation.effectiveInner.width + EPSILON,
        )
        expect(placement.z + placement.height).toBeLessThanOrEqual(
          recommendation.effectiveInner.height + EPSILON,
        )
      }

      for (
        let leftIndex = 0;
        leftIndex < recommendation.placements.length;
        leftIndex += 1
      ) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < recommendation.placements.length;
          rightIndex += 1
        ) {
          expect(
            placementsOverlap(
              recommendation.placements[leftIndex],
              recommendation.placements[rightIndex],
            ),
          ).toBe(false)
        }
      }
    })

    it('preserves product quantities across split boxes', () => {
      const { split } = recommendPackingPlans({
        products,
        cartons,
        cushions,
        orderLines: defaultOrderLines,
      })
      const recommendation = split[0]
      const actualQuantities = new Map<string, number>()

      expect(recommendation).toBeDefined()

      for (const box of recommendation.boxes) {
        const boxQuantity = box.items.reduce((sum, item) => {
          actualQuantities.set(
            item.productId,
            (actualQuantities.get(item.productId) ?? 0) + item.quantity,
          )
          return sum + item.quantity
        }, 0)

        expect(box.recommendation.placements).toHaveLength(boxQuantity)
      }

      expect(actualQuantities).toEqual(positiveOrderQuantities())
    })

    it('returns deterministic recommendations for identical input', () => {
      const input = {
        products,
        cartons,
        cushions,
        orderLines: defaultOrderLines,
      }
      const first = recommendPackingPlans(input)
      const second = recommendPackingPlans(input)

      expect(second).toEqual(first)
    })

    it('does not invalidate packing results when only product prices change', () => {
      const repricedProducts: Product[] = products.map((product, index) => ({
        ...product,
        priceYen: 10_000 + index,
      }))
      const original = recommendPackingPlans({
        products,
        cartons,
        cushions,
        orderLines: defaultOrderLines,
      })
      const repriced = recommendPackingPlans({
        products: repricedProducts,
        cartons,
        cushions,
        orderLines: defaultOrderLines,
      })

      expect(repriced).toEqual(original)
    })

    it('rejects an impossible high-volume order without producing candidates', () => {
      const oversizedOrder = defaultOrderLines.map((line) => ({
        ...line,
        quantity: 999,
      }))
      const result = recommendPackingPlans({
        products,
        cartons,
        cushions,
        orderLines: oversizedOrder,
      })

      expect(result.single).toEqual([])
      expect(result.split).toEqual([])
    })
  })

  const cube: Product = {
    ...products[0],
    id: 'cube',
    size: { length: 40, width: 40, height: 40 },
    weight: 1,
  }
  const noPadding = {
    ...cushions[0],
    itemWrapThickness: 2,
    sidePadding: 0,
    topPadding: 0,
    bottomPadding: 0,
  }
  const smallBox = {
    ...cartons[0],
    inner: { length: 40, width: 40, height: 40 },
    maxLoadWeightGrams: null,
  }
  const cubeRequest: PackingRequest = {
    products: [cube],
    cartons: [smallBox],
    cushions: [noPadding],
    orderLines: [{ productId: cube.id, quantity: 1, useItemWrap: false }],
  }

  describe('physical packing constraints', () => {
    it('does not use volumetric weight as a load limit', () => {
      const request = {
        ...cubeRequest,
        products: [{ ...cube, weight: 1600 }],
        cartons: [cartons[0]],
        cushions,
      }
      expect(recommendPacking(request).length).toBeGreaterThan(0)
      expect(
        recommendPacking({
          ...request,
          cartons: [{ ...cartons[0], maxLoadWeightGrams: 1500 }],
        }),
      ).toEqual([])
    })

    it('counts individual wrapping in the occupied dimensions', () => {
      expect(recommendPacking(cubeRequest)).toHaveLength(1)
      expect(
        recommendPacking({
          ...cubeRequest,
          orderLines: [{ productId: cube.id, quantity: 1, useItemWrap: true }],
        }),
      ).toEqual([])
      const wrapped = recommendPacking({
        ...cubeRequest,
        cartons: [
          { ...smallBox, inner: { length: 50, width: 50, height: 50 } },
        ],
        orderLines: [{ productId: cube.id, quantity: 1, useItemWrap: true }],
      })[0]
      expect(wrapped.placements[0].productSize).toEqual(cube.size)
      expect(wrapped.placements[0].length).toBe(44)
      expect(wrapped.placements[0].width).toBe(44)
      expect(wrapped.placements[0].height).toBe(44)
      expect(wrapped.emptyVolume).toBe(50 ** 3 - 44 ** 3)
    })

    it('preserves product dimensions when rotating a wrapped item', () => {
      const product = { ...cube, size: { length: 20, width: 30, height: 70 } }
      const recommendation = recommendPacking({
        ...cubeRequest,
        products: [product],
        cartons: [
          { ...smallBox, inner: { length: 100, width: 100, height: 100 } },
        ],
        cushions: [cushions[0]],
        orderLines: [{ productId: cube.id, quantity: 1, useItemWrap: true }],
      })[0]
      const placement = recommendation.placements[0]
      expect(
        Object.values(placement.productSize).sort((a, b) => a - b),
      ).toEqual([20, 30, 70])
      expect(placement.length * placement.width * placement.height).toBe(
        30 * 40 * 80,
      )
    })

    it('keeps flat layers separated by 10mm and allows a configured third layer', () => {
      const request = {
        ...cubeRequest,
        cartons: [
          { ...smallBox, inner: { length: 120, width: 40, height: 140 } },
        ],
        orderLines: [{ productId: cube.id, quantity: 6, useItemWrap: false }],
      }
      expect(recommendPacking(request)).toEqual([])
      const plan = recommendPacking({ ...request, maxLayers: 3 })[0]
      expect(plan.layers).toHaveLength(3)
      expect(plan.placements.filter((p) => p.layerIndex === 0)).toHaveLength(3)
      expect(plan.placements.filter((p) => p.layerIndex === 1)).toHaveLength(2)
      expect(plan.placements.filter((p) => p.layerIndex === 2)).toHaveLength(1)
      for (let i = 1; i < plan.layers.length; i++) {
        expect(plan.layers[i].z).toBe(
          plan.layers[i - 1].z +
            plan.layers[i - 1].height +
            LAYER_SEPARATOR_HEIGHT,
        )
      }
      expect(plan.emptyVolume).toBe(
        120 * 40 * 140 - 6 * 40 ** 3 - 2 * 120 * 40 * 10,
      )
    })

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid dimension %s',
      (length) => {
        expect(
          recommendPackingPlans({
            ...cubeRequest,
            products: [{ ...cube, size: { ...cube.size, length } }],
          }),
        ).toEqual({ single: [], split: [] })
      },
    )

    it.each([-1, 1.5, 1000, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid quantity %s',
      (quantity) => {
        expect(
          recommendPackingPlans({
            ...cubeRequest,
            orderLines: [{ productId: cube.id, quantity, useItemWrap: false }],
          }),
        ).toEqual({ single: [], split: [] })
      },
    )

    it('rejects unknown and duplicate order lines instead of silently dropping products', () => {
      expect(
        recommendPacking({
          ...cubeRequest,
          orderLines: [
            { productId: 'missing', quantity: 1, useItemWrap: false },
          ],
        }),
      ).toEqual([])
      expect(
        recommendPacking({
          ...cubeRequest,
          orderLines: [...cubeRequest.orderLines, ...cubeRequest.orderLines],
        }),
      ).toEqual([])
    })

    it.each(['compact', 'stable'] as const)(
      'keeps all wrapped %s candidates within bounds and without overlap',
      (strategy) => {
        const { single, split } = recommendPackingPlans({
          products,
          cartons,
          cushions,
          strategy,
          orderLines: defaultOrderLines.map((line) => ({
            ...line,
            useItemWrap: true,
          })),
        })
        expect(single.length).toBeGreaterThan(0)
        expect(split.length).toBeGreaterThan(0)
        for (const plan of [
          ...single,
          ...split.flatMap((candidate) =>
            candidate.boxes.map((box) => box.recommendation),
          ),
        ]) {
          for (const p of plan.placements) {
            expect(p.x + p.length).toBeLessThanOrEqual(
              plan.effectiveInner.length + EPSILON,
            )
            expect(p.y + p.width).toBeLessThanOrEqual(
              plan.effectiveInner.width + EPSILON,
            )
            expect(p.z + p.height).toBeLessThanOrEqual(
              plan.effectiveInner.height + EPSILON,
            )
            expect(p.length).toBeGreaterThanOrEqual(p.productSize.length)
            expect(p.width).toBeGreaterThanOrEqual(p.productSize.width)
            expect(p.height).toBeGreaterThanOrEqual(p.productSize.height)
          }
          for (let i = 0; i < plan.placements.length; i++) {
            for (let j = i + 1; j < plan.placements.length; j++) {
              expect(
                placementsOverlap(plan.placements[i], plan.placements[j]),
              ).toBe(false)
            }
          }
        }
      },
    )
  })
}
