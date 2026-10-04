import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { URL } from 'node:url'
import {
  isValidPackingRequest,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { parseWasmPlans } from '@/packingWasmResult'

export async function loadRustCalculator() {
  const root = new URL('../../public/wasm/', import.meta.url)
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  )
  const context = createContext({
    TextDecoder,
    TextEncoder,
    WebAssembly,
    URL,
    Response,
    Request,
    console,
    wasmBytes: await readFile(new URL(manifest.wasmFile, root)),
  })
  runInContext(
    await readFile(new URL(manifest.glueFile, root), 'utf8'),
    context,
  )
  await runInContext('wasm_bindgen({ module_or_path: wasmBytes })', context)
  const bindings = context.packing_wasm_bindgen as {
    core_version: () => string
    recommend_packing_plans: (json: string, limit?: number) => string
  }
  if (bindings.core_version() !== manifest.coreVersion)
    throw new Error('WASM version mismatch')
  return (request: PackingRequest, limit?: number): PackingPlanOptions =>
    isValidPackingRequest(request)
      ? parseWasmPlans(
          bindings.recommend_packing_plans(JSON.stringify(request), limit),
        )
      : { single: [], split: [] }
}
