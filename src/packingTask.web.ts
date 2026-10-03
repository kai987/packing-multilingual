import type { PackingPlanOptions, PackingRequest } from '@/packing'
import {
  createPackingTask as createFallbackTask,
  type PackingTask,
} from '@/packingTaskFallback'

export function createPackingTask(request: PackingRequest): PackingTask {
  if (typeof Worker === 'undefined') return createFallbackTask(request)
  const worker = new Worker(new URL('./packing.worker', window.location.href))
  let settled = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  let rejectResult: (error: Error) => void = () => undefined
  const close = () => {
    if (settled) return false
    settled = true
    clearTimeout(timeout)
    worker.terminate()
    return true
  }
  const result = new Promise<PackingPlanOptions>((resolve, reject) => {
    rejectResult = reject
    timeout = setTimeout(() => {
      if (close()) reject(new Error('Packing calculation timed out'))
    }, 30_000)
    worker.onmessage = ({
      data,
    }: MessageEvent<{ options?: PackingPlanOptions; error?: string }>) => {
      if (!close()) return
      if (data.options) resolve(data.options)
      else reject(new Error(data.error ?? 'Packing worker failed'))
    }
    worker.onerror = (event) => {
      if (close()) reject(new Error(event.message || 'Packing worker failed'))
    }
    worker.onmessageerror = () => {
      if (close()) reject(new Error('Could not decode packing results'))
    }
    try {
      worker.postMessage(request)
    } catch (error) {
      if (close()) reject(error)
    }
  })
  return {
    result,
    cancel: () => {
      if (close()) rejectResult(new Error('Packing calculation cancelled'))
    },
  }
}
