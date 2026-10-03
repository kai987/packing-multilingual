import { startTransition, useCallback, useEffect, useState } from 'react'
import type { PackingPlanOptions, PackingRequest } from '@/packing'
import { createPackingTask, type PackingTask } from '@/packingTask'

const emptyOptions: PackingPlanOptions = { single: [], split: [] }

export function usePackingPlans(request: PackingRequest) {
  const [retryToken, setRetryToken] = useState(0)
  const [result, setResult] = useState<{
    request: PackingRequest | null
    retryToken: number
    options: PackingPlanOptions
    error: string | null
  }>({ request: null, retryToken: 0, options: emptyOptions, error: null })

  useEffect(() => {
    let active = true
    let task: PackingTask | undefined
    const timer = setTimeout(() => {
      try {
        task = createPackingTask(request)
        void task.result
          .then((options) => {
            if (!active) return
            startTransition(() =>
              setResult({ request, retryToken, options, error: null }),
            )
          })
          .catch((error: unknown) => {
            if (!active) return
            setResult({
              request,
              retryToken,
              options: emptyOptions,
              error: String(error),
            })
          })
      } catch (error) {
        if (active)
          setResult({
            request,
            retryToken,
            options: emptyOptions,
            error: String(error),
          })
      }
    }, 150)
    return () => {
      active = false
      clearTimeout(timer)
      task?.cancel()
    }
  }, [request, retryToken])

  const isCalculating =
    result.request !== request || result.retryToken !== retryToken
  const retry = useCallback(() => setRetryToken((current) => current + 1), [])
  return {
    options: result.options,
    isCalculating,
    error: isCalculating ? null : result.error,
    retry,
  }
}
