import type { PackingPlanOptions, PackingRequest } from '@/packing'
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
      void import('@/packing')
        .then(({ recommendPackingPlans }) => {
          if (!cancelled)
            resolve(getVisiblePackingPlans(recommendPackingPlans(request)))
        })
        .catch(reject)
    }, 0)
  })
  return {
    result,
    backend: 'typescript',
    usedFallback: false,
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
      rejectResult(new Error('Packing calculation cancelled'))
    },
  }
}
