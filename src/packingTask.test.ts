import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPackingPlans, type PackingPlanOptions } from '@/packing'
import { createPackingTask } from '@/packingTask.web'
import { getVisiblePackingPlans } from '@/packingTaskShared'

const request = { products, cartons, cushions, orderLines: defaultOrderLines }
const workers: FakeWorker[] = []

class FakeWorker {
  onmessage:
    | ((event: MessageEvent<{ options: PackingPlanOptions }>) => void)
    | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    workers.push(this)
  }
}

afterEach(() => {
  workers.length = 0
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('packing task', () => {
  it('sends inputs to a worker and returns the same algorithm result', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', {
      location: { href: 'https://example.com/packing-multilingual/' },
    })
    const task = createPackingTask(request)
    const worker = workers[0]
    expect(worker.postMessage).toHaveBeenCalledWith(request)
    const options = recommendPackingPlans(request)
    worker.onmessage?.({ data: { options } } as MessageEvent<{
      options: PackingPlanOptions
    }>)
    expect(await task.result).toEqual(options)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates obsolete work independently of a replacement task', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', { location: { href: 'https://example.com/' } })
    const oldTask = createPackingTask(request)
    createPackingTask(request)
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
  })

  it('reports worker failure instead of leaving the calculation stuck', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', { location: { href: 'https://example.com/' } })
    const task = createPackingTask(request)
    const assertion = expect(task.result).rejects.toThrow('worker unavailable')
    workers[0].onerror?.({ message: 'worker unavailable' } as ErrorEvent)
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })

  it('uses the scheduled fallback on platforms without Worker', async () => {
    vi.stubGlobal('Worker', undefined)
    vi.useFakeTimers()
    const task = createPackingTask(request)
    await vi.runAllTimersAsync()
    expect(await task.result).toEqual(
      getVisiblePackingPlans(recommendPackingPlans(request)),
    )
  })

  it('times out a worker that never responds and releases its resources', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', { location: { href: 'https://example.com/' } })
    vi.useFakeTimers()
    const task = createPackingTask(request)
    const assertion = expect(task.result).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
})
