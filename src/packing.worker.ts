import {
  calculateWorkerRequest,
  type PackingWorkerRequest,
  type PackingWorkerResult,
} from '@/packingWorkerEngine'

const workerScope = self as unknown as {
  onmessage: (event: MessageEvent<PackingWorkerRequest>) => void
  postMessage: (response: PackingWorkerResult | { error: string }) => void
}

workerScope.onmessage = ({ data }) => {
  void calculateWorkerRequest(data)
    .then((result) => workerScope.postMessage(result))
    .catch((error: unknown) => {
      workerScope.postMessage({
        error:
          error instanceof Error ? error.message : 'Packing calculation failed',
      })
    })
}
