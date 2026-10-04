import type { PackingRequest } from '@/packing'

export function getPackingRequestKey(request: PackingRequest): string {
  // Prices do not affect geometry; changing them should not restart a Worker.
  return JSON.stringify(request, (key, value: unknown) =>
    key === 'priceYen' ? undefined : value,
  )
}
