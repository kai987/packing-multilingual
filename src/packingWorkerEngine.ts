import {
  recommendPackingPlans,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { getVisiblePackingPlans } from '@/packingTaskShared'
import { loadWasmPacking } from '@/packingWasm'

export type PackingBackend = 'rust-wasm' | 'typescript'
export type PackingWorkerRequest = {
  request: PackingRequest
  manifestUrl: string
}
export type PackingWorkerResult = {
  options: PackingPlanOptions
  backend: PackingBackend
  usedFallback: boolean
}

export async function calculateWorkerRequest(
  { request, manifestUrl }: PackingWorkerRequest,
  loadWasm = loadWasmPacking,
): Promise<PackingWorkerResult> {
  try {
    const calculate = await loadWasm(manifestUrl)
    return {
      options: calculate(request),
      backend: 'rust-wasm',
      usedFallback: false,
    }
  } catch {
    return {
      options: getVisiblePackingPlans(recommendPackingPlans(request)),
      backend: 'typescript',
      usedFallback: true,
    }
  }
}
