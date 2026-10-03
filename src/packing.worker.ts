import {
  recommendPackingPlans,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'

const workerScope = self as unknown as {
  onmessage: (event: MessageEvent<PackingRequest>) => void
  postMessage: (
    response: { options: PackingPlanOptions } | { error: string },
  ) => void
}

workerScope.onmessage = ({ data }) => {
  try {
    workerScope.postMessage({
      options: getVisiblePackingPlans(recommendPackingPlans(data)),
    })
  } catch (error) {
    workerScope.postMessage({
      error:
        error instanceof Error ? error.message : 'Packing calculation failed',
    })
  }
}
