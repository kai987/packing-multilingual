import { describe, expect, it } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import { calculateWorkerRequest } from '@/packingWorkerEngine'

const message = {
  request: { products, cartons, cushions, orderLines: defaultOrderLines },
  manifestUrl: 'https://example.com/packing-multilingual/wasm/manifest.json',
}

describe('worker engine selection', () => {
  it('reports real WASM results without running the fallback', async () => {
    const options = { single: [], split: [] }
    const result = await calculateWorkerRequest(
      message,
      async () => () => options,
    )
    expect(result).toEqual({
      options,
      backend: 'rust-wasm',
      usedFallback: false,
    })
  })
  it.each(['load', 'calculation'])(
    'falls back when WASM %s fails',
    async (phase) => {
      const result = await calculateWorkerRequest(message, async () => {
        if (phase === 'load') throw new Error('missing WASM asset')
        return () => {
          throw new Error('WASM trap')
        }
      })
      expect(result).toEqual({
        options: getVisiblePackingPlans(recommendPackingPlans(message.request)),
        backend: 'typescript',
        usedFallback: true,
      })
    },
  )
})
