import type { PackingPlanOptions } from '@/packing'

export function parseWasmPlans(json: string): PackingPlanOptions {
  const plans = JSON.parse(json) as PackingPlanOptions
  if (!Array.isArray(plans.single) || !Array.isArray(plans.split)) {
    throw new Error('Invalid packing WASM response')
  }
  // Display collation belongs to JS; Rust uses deterministic ID ordering only.
  for (const plan of plans.split) {
    for (const box of plan.boxes) {
      box.items.sort((left, right) => left.name.localeCompare(right.name))
    }
  }
  return plans
}
