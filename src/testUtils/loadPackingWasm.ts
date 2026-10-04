import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import {
  isValidPackingRequest,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { parseWasmPlans } from '@/packingWasmResult'
import type { WasmBindings } from '@/packingWasm'

export async function loadRustCalculator() {
  const root = new URL('../../public/wasm/', import.meta.url)
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  )
  const bindings: WasmBindings = await import(
    new URL(manifest.glueFile, root).href
  )
  const bytes = await readFile(new URL(manifest.wasmFile, root))
  await bindings.default({ module_or_path: new Uint8Array(bytes).buffer })
  if (bindings.core_version() !== manifest.coreVersion)
    throw new Error('WASM version mismatch')
  return (request: PackingRequest, limit?: number): PackingPlanOptions =>
    isValidPackingRequest(request)
      ? parseWasmPlans(
          bindings.recommend_packing_plans(JSON.stringify(request), limit),
        )
      : { single: [], split: [] }
}
