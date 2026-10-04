import type { PackingPlanOptions, PackingRequest } from '@/packing'
import type { PackingBackend, PackingWorkerResult } from '@/packingWorkerEngine'
import {
  createPackingTask as createFallbackTask,
  type PackingTask,
} from '@/packingTaskFallback'

export type { PackingTask } from '@/packingTaskFallback'

export function createPackingTask(request: PackingRequest): PackingTask {
  if (typeof Worker === 'undefined') return createFallbackTask(request)
  let worker: Worker
  try {
    worker = new Worker(new URL('./packing.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch {
    return createFallbackTask(request)
  }
  let settled = false
  let backend: PackingBackend = 'typescript'
  let usedFallback = false
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
    }: MessageEvent<Partial<PackingWorkerResult> & { error?: string }>) => {
      if (!close()) return
      if (data.options) {
        backend = data.backend ?? 'typescript'
        usedFallback = data.usedFallback ?? false
        resolve(data.options)
      } else reject(new Error(data.error ?? 'Packing worker failed'))
    }
    worker.onerror = (event) => {
      if (close()) reject(new Error(event.message || 'Packing worker failed'))
    }
    worker.onmessageerror = () => {
      if (close()) reject(new Error('Could not decode packing results'))
    }
    try {
      worker.postMessage({
        request,
        manifestUrl: getPackingManifestUrl(
          window.location.href,
          import.meta.env.BASE_URL,
        ),
      })
    } catch (error) {
      if (close()) reject(error)
    }
  })
  return {
    result,
    get backend() {
      return backend
    },
    get usedFallback() {
      return usedFallback
    },
    cancel: () => {
      if (close()) rejectResult(new Error('Packing calculation cancelled'))
    },
  }
}

export function getPackingManifestUrl(
  pageUrl: string,
  basePath: string,
): string {
  return new URL('wasm/manifest.json', new URL(basePath, pageUrl)).href
}
