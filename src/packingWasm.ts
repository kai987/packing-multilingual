import {
  isValidPackingRequest,
  type PackingPlanOptions,
  type PackingRequest,
} from '@/packing'
import { parseWasmPlans } from '@/packingWasmResult'

export type WasmCalculator = (request: PackingRequest) => PackingPlanOptions
export type WasmBindings = {
  default: (input: { module_or_path: ArrayBuffer }) => Promise<unknown>
  core_version: () => string
  recommend_packing_plans: (input: string, limit?: number) => string
}
type WasmManifest = {
  schemaVersion: number
  bindingFormat: string
  coreVersion: string
  glueFile: string
  wasmFile: string
}

const importBindings = (url: string): Promise<WasmBindings> =>
  import(/* @vite-ignore */ url)

export async function loadWasmPacking(
  manifestUrl: string,
  loadBindings = importBindings,
): Promise<WasmCalculator> {
  if (typeof WebAssembly === 'undefined')
    throw new Error('WebAssembly is unavailable')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('WASM initialization timed out'))
      controller.abort()
    }, 5000)
  })
  const loading = async (): Promise<WasmCalculator> => {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`WASM manifest HTTP ${response.status}`)
    const manifest = (await response.json()) as WasmManifest
    if (
      manifest.schemaVersion !== 1 ||
      manifest.bindingFormat !== 'esm' ||
      manifest.coreVersion !== '0.1.0' ||
      !/^packing_core-[a-f0-9]{16}\.js$/.test(manifest.glueFile) ||
      manifest.wasmFile !== manifest.glueFile.replace(/\.js$/, '.wasm')
    )
      throw new Error('Incompatible WASM manifest')
    const wasmResponse = await fetch(
      new URL(manifest.wasmFile, manifestUrl).href,
      { signal: controller.signal },
    )
    if (!wasmResponse.ok)
      throw new Error(`WASM binary HTTP ${wasmResponse.status}`)
    const bytes = await wasmResponse.arrayBuffer()
    const bindings = await loadBindings(
      new URL(manifest.glueFile, manifestUrl).href,
    )
    if (controller.signal.aborted)
      throw new Error('WASM initialization timed out')
    await bindings.default({ module_or_path: bytes })
    if (bindings.core_version() !== manifest.coreVersion)
      throw new Error('WASM version mismatch')
    return (request) =>
      isValidPackingRequest(request)
        ? parseWasmPlans(
            bindings.recommend_packing_plans(JSON.stringify(request), 3),
          )
        : { single: [], split: [] }
  }
  try {
    return await Promise.race([loading(), timeout])
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
