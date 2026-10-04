import {
  isValidPackingRequest,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { parseWasmPlans } from '@/packingWasmResult'

export type WasmCalculator = (request: PackingRequest) => PackingPlanOptions
type Bindings = {
  (input: { module_or_path: ArrayBuffer }): Promise<unknown>
  core_version: () => string
  recommend_packing_plans: (input: string, limit: number) => string
}
type WasmManifest = {
  schemaVersion: number
  coreVersion: string
  glueFile: string
  wasmFile: string
}

export async function loadWasmPacking(
  manifestUrl: string,
): Promise<WasmCalculator> {
  const scope = self as unknown as {
    importScripts: (url: string) => void
    packing_wasm_bindgen?: Bindings
  }
  if (
    typeof WebAssembly === 'undefined' ||
    typeof scope.importScripts !== 'function'
  ) {
    throw new Error('WebAssembly worker is unavailable')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`WASM manifest HTTP ${response.status}`)
    const manifest = (await response.json()) as WasmManifest
    const file = /^packing_core-[a-f0-9]{16}\.(js|wasm)$/
    if (
      manifest.schemaVersion !== 1 ||
      manifest.coreVersion !== '0.1.0' ||
      !file.test(manifest.glueFile) ||
      !manifest.glueFile.endsWith('.js') ||
      manifest.wasmFile !== manifest.glueFile.replace(/\.js$/, '.wasm')
    ) {
      throw new Error('Incompatible WASM manifest')
    }
    const wasmUrl = new URL(manifest.wasmFile, manifestUrl).href
    const wasmResponse = await fetch(wasmUrl, { signal: controller.signal })
    if (!wasmResponse.ok)
      throw new Error(`WASM binary HTTP ${wasmResponse.status}`)
    const bytes = await wasmResponse.arrayBuffer()
    scope.importScripts(new URL(manifest.glueFile, manifestUrl).href)
    const bindings = scope.packing_wasm_bindgen
    if (!bindings) throw new Error('WASM bindings did not load')
    await bindings({ module_or_path: bytes })
    if (bindings.core_version() !== manifest.coreVersion)
      throw new Error('WASM version mismatch')
    return (request) =>
      isValidPackingRequest(request)
        ? parseWasmPlans(
            bindings.recommend_packing_plans(JSON.stringify(request), 3),
          )
        : { single: [], split: [] }
  } finally {
    clearTimeout(timer)
  }
}
