import { recommendPackingPlans, type PackingPlanOptions, type PackingRequest } from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import type { PackingBackend } from '@/packingWorkerEngine'

export type PackingTask = {
  result: Promise<PackingPlanOptions>
  cancel: () => void
  readonly backend: PackingBackend
  readonly usedFallback: boolean
}

export function createPackingTask(request: PackingRequest): PackingTask {
  let cancelled = false
  let timer: ReturnType<typeof setTimeout>
  let rejectResult: (error: Error) => void = () => undefined
  const result = new Promise<PackingPlanOptions>((resolve, reject) => {
    rejectResult = reject
    timer = setTimeout(() => {
      try {
        if (!cancelled)
          resolve(getVisiblePackingPlans(recommendPackingPlans(request)))
      } catch (error) {
        reject(error)
      }
    }, 0)
  })
  return {
    result,
    backend: 'typescript',
    usedFallback: true,
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
      rejectResult(new Error('Packing calculation cancelled'))
    },
  }
}
