import type { PackingPlanOptions } from '@/packing'

export function getVisiblePackingPlans(
  options: PackingPlanOptions,
): PackingPlanOptions {
  return {
    single: options.single.slice(0, 3),
    split: options.split.slice(0, 3),
  }
}
