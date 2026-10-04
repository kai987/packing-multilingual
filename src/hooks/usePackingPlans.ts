import { startTransition, useCallback, useEffect, useState } from 'react'
import type { PackingPlanOptions, PackingRequest } from '@/packing'
import { createPackingTask, type PackingTask } from '@/packingTask'
import type { PackingBackend } from '@/packingWorkerEngine'
import { getPackingRequestKey } from '@/packingRequestKey'

const emptyOptions: PackingPlanOptions = { single: [], split: [] }

export function usePackingPlans(request: PackingRequest) {
  const requestKey = getPackingRequestKey(request)
  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<{
    requestKey: string | null
    retryToken: number
    options: PackingPlanOptions
    error: string | null
    backend: PackingBackend | null
    usedFallback: boolean
  }>({
    requestKey: null,
    retryToken: 0,
    options: emptyOptions,
    error: null,
    backend: null,
    usedFallback: false,
  })

  useEffect(() => {
    let active = true
    let task: PackingTask | undefined
    const timer = setTimeout(() => {
      try {
        const currentTask = createPackingTask(
          JSON.parse(requestKey) as PackingRequest,
        )
        task = currentTask
        void currentTask.result
          .then((options) => {
            if (!active) return
            startTransition(() =>
              setResult({
                requestKey,
                retryToken,
                options,
                error: null,
                backend: currentTask.backend,
                usedFallback: currentTask.usedFallback,
              }),
            )
          })
          .catch((error: unknown) => {
            if (!active) return
            setResult({
              requestKey,
              retryToken,
              options: emptyOptions,
              error: String(error),
              backend: null,
              usedFallback: false,
            })
          })
      } catch (error) {
        if (active)
          setResult({
            requestKey,
            retryToken,
            options: emptyOptions,
            error: String(error),
            backend: null,
            usedFallback: false,
          })
      }
    }, 150)
    return () => {
      active = false
      clearTimeout(timer)
      task?.cancel()
    }
  }, [requestKey, retryToken])

  const isCalculating =
    result.requestKey !== requestKey || result.retryToken !== retryToken
  const retry = useCallback(() => setRetryToken((current) => current + 1), [])
  return {
    options: result.options,
    isCalculating,
    error: isCalculating ? null : result.error,
    retry,
    backend: result.backend,
    usedFallback: result.usedFallback,
  }
}
