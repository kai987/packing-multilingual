import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import { loadWasmPacking } from '@/packingWasm'
import type { PackingWorkerRequest } from '@/packingWorkerEngine'

vi.mock('@/packingWasm', () => ({ loadWasmPacking: vi.fn() }))
beforeEach(() => {
  vi.resetModules()
  vi.mocked(loadWasmPacking).mockReset()
})

afterEach(() => vi.unstubAllGlobals())

it('calculates in the worker and transfers only the three visible candidates of each kind', async () => {
  const scope: {
    postMessage: ReturnType<typeof vi.fn>
    onmessage?: (event: MessageEvent<PackingWorkerRequest>) => void
  } = { postMessage: vi.fn() }
  vi.stubGlobal('self', scope)
  vi.mocked(loadWasmPacking).mockResolvedValue((request) =>
    getVisiblePackingPlans(recommendPackingPlans(request)),
  )
  await import('@/packing.worker')
  const request = { products, cartons, cushions, orderLines: defaultOrderLines }
  scope.onmessage?.(
    new MessageEvent('message', {
      data: { request, manifestUrl: 'https://example.com/wasm/manifest.json' },
    }),
  )
  await vi.waitFor(() =>
    expect(scope.postMessage).toHaveBeenCalledWith({
      options: getVisiblePackingPlans(recommendPackingPlans(request)),
      backend: 'rust-wasm',
      usedFallback: false,
    }),
  )
  const { options } = scope.postMessage.mock.calls[0][0]
  expect(options.single).toHaveLength(3)
  expect(options.split).toHaveLength(3)
})
