import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans } from '@/packing'
import { createPackingTask, getPackingManifestUrl } from '@/packingTask'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import type { PackingWorkerResult } from '@/packingWorkerEngine'

const request = { products, cartons, cushions, orderLines: defaultOrderLines }
const workers: FakeWorker[] = []
class FakeWorker {
  onmessage:
    | ((event: MessageEvent<Partial<PackingWorkerResult>>) => void)
    | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    workers.push(this)
  }
}
const stubWorker = () => {
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('window', {
    location: { href: 'https://example.com/packing-multilingual/' },
  })
  vi.stubEnv('BASE_URL', '/packing-multilingual/')
}
afterEach(() => {
  workers.length = 0
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Vite packing task', () => {
  it.each([
    [
      'https://example.com/packing-multilingual/',
      '/packing-multilingual/',
      'https://example.com/packing-multilingual/wasm/manifest.json',
    ],
    [
      'https://example.com/packing-multilingual',
      '/packing-multilingual/',
      'https://example.com/packing-multilingual/wasm/manifest.json',
    ],
    [
      'https://example.com/packing-multilingual/index.html',
      '/packing-multilingual/',
      'https://example.com/packing-multilingual/wasm/manifest.json',
    ],
    ['http://localhost:5173/', '/', 'http://localhost:5173/wasm/manifest.json'],
    [
      'https://example.com/packing-multilingual/nested#plan',
      '/packing-multilingual/',
      'https://example.com/packing-multilingual/wasm/manifest.json',
    ],
  ])('uses the configured Vite base for %s', (pageUrl, base, expected) => {
    expect(getPackingManifestUrl(pageUrl, base)).toBe(expected)
  })
  it('sends inputs and exposes Rust metadata before resolving', async () => {
    stubWorker()
    const task = createPackingTask(request)
    expect(workers[0].postMessage).toHaveBeenCalledWith({
      request,
      manifestUrl:
        'https://example.com/packing-multilingual/wasm/manifest.json',
    })
    const options = getVisiblePackingPlans(recommendPackingPlans(request))
    workers[0].onmessage?.(
      new MessageEvent<PackingWorkerResult>('message', {
        data: { options, backend: 'rust-wasm', usedFallback: false },
      }),
    )
    expect(await task.result).toEqual(options)
    expect(task.backend).toBe('rust-wasm')
    expect(task.usedFallback).toBe(false)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
  it('exposes TypeScript fallback metadata', async () => {
    stubWorker()
    const task = createPackingTask(request)
    workers[0].onmessage?.(
      new MessageEvent<PackingWorkerResult>('message', {
        data: {
          options: { single: [], split: [] },
          backend: 'typescript',
          usedFallback: true,
        },
      }),
    )
    await task.result
    expect(task.backend).toBe('typescript')
    expect(task.usedFallback).toBe(true)
  })
  it('terminates obsolete work without stopping its replacement', async () => {
    stubWorker()
    const oldTask = createPackingTask(request)
    const replacement = createPackingTask(request)
    const assertion = expect(oldTask.result).rejects.toThrow('cancelled')
    oldTask.cancel()
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(workers[1].terminate).not.toHaveBeenCalled()
    workers[1].onmessage?.(
      new MessageEvent('message', {
        data: { options: { single: [], split: [] } },
      }),
    )
    await replacement.result
  })
  it('reports bootstrap errors and releases the worker', async () => {
    stubWorker()
    const task = createPackingTask(request)
    const assertion = expect(task.result).rejects.toThrow('worker unavailable')
    workers[0].onerror?.({ message: 'worker unavailable' } as ErrorEvent)
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
  it('reports decoding failures', async () => {
    stubWorker()
    const task = createPackingTask(request)
    const assertion = expect(task.result).rejects.toThrow('decode')
    workers[0].onmessageerror?.()
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
  it.each(['absent', 'constructor error'])(
    'falls back if Worker is %s',
    async (failure) => {
      vi.stubGlobal(
        'Worker',
        failure === 'absent'
          ? undefined
          : class {
              constructor() {
                throw new Error('blocked')
              }
            },
      )
      vi.useFakeTimers()
      const task = createPackingTask(request)
      await vi.runAllTimersAsync()
      expect(await task.result).toEqual(
        getVisiblePackingPlans(recommendPackingPlans(request)),
      )
      expect(task.backend).toBe('typescript')
      expect(task.usedFallback).toBe(true)
    },
  )
  it('bounds the full task by thirty seconds', async () => {
    stubWorker()
    vi.useFakeTimers()
    const task = createPackingTask(request)
    const assertion = expect(task.result).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
})
