import { afterEach, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans, type PackingRequest } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'

afterEach(() => vi.unstubAllGlobals())

it('calculates in the worker and transfers only the three visible candidates of each kind', async () => {
  const scope: {
    postMessage: ReturnType<typeof vi.fn>
    onmessage?: (event: MessageEvent<PackingRequest>) => void
  } = { postMessage: vi.fn() }
  vi.stubGlobal('self', scope)
  await import('@/packing.worker')
  const request = { products, cartons, cushions, orderLines: defaultOrderLines }
  scope.onmessage?.(new MessageEvent('message', { data: request }))
  expect(scope.postMessage).toHaveBeenCalledWith({
    options: getVisiblePackingPlans(recommendPackingPlans(request)),
  })
  const { options } = scope.postMessage.mock.calls[0][0]
  expect(options.single).toHaveLength(3)
  expect(options.split).toHaveLength(3)
})
