import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { loadWasmPacking } from '@/packingWasm'

const manifest = {
  schemaVersion: 1,
  coreVersion: '0.1.0',
  glueFile: 'packing_core-0123456789abcdef.js',
  wasmFile: 'packing_core-0123456789abcdef.wasm',
}
const url = 'https://example.com/packing-multilingual/wasm/manifest.json'
const request = { products, cartons, cushions, orderLines: defaultOrderLines }
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('WASM loader', () => {
  it('loads same-directory hashed assets and calls the limited Rust API', async () => {
    const bindings = Object.assign(vi.fn().mockResolvedValue({}), {
      core_version: () => '0.1.0',
      recommend_packing_plans: vi
        .fn()
        .mockReturnValue('{"single":[],"split":[]}'),
    })
    const scope = { packing_wasm_bindgen: bindings, importScripts: vi.fn() }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])))
    vi.stubGlobal('self', scope)
    vi.stubGlobal('fetch', fetcher)
    const calculate = await loadWasmPacking(url)
    expect(calculate(request)).toEqual({ single: [], split: [] })
    expect(bindings.recommend_packing_plans).toHaveBeenCalledWith(
      JSON.stringify(request),
      3,
    )
    expect(scope.importScripts).toHaveBeenCalledWith(
      new URL(manifest.glueFile, url).href,
    )
    expect(fetcher.mock.calls[1][0]).toBe(new URL(manifest.wasmFile, url).href)
    calculate({
      ...request,
      orderLines: [{ ...defaultOrderLines[0], quantity: Infinity }],
    })
    expect(bindings.recommend_packing_plans).toHaveBeenCalledOnce()
  })
  it('rejects asset paths outside the generated namespace', async () => {
    vi.stubGlobal('self', { importScripts: vi.fn() })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...manifest, glueFile: '../foreign.js' }),
        ),
    )
    await expect(loadWasmPacking(url)).rejects.toThrow('manifest')
  })
  it('rejects missing assets so the worker can use TypeScript', async () => {
    vi.stubGlobal('self', { importScripts: vi.fn() })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 })),
    )
    await expect(loadWasmPacking(url)).rejects.toThrow('404')
  })
  it('aborts stalled asset requests after five seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('self', { importScripts: vi.fn() })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            )
          }),
      ),
    )
    const assertion = expect(loadWasmPacking(url)).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })
  it('rejects engines with an incompatible version', async () => {
    const bindings = Object.assign(vi.fn().mockResolvedValue({}), {
      core_version: () => 'incompatible',
    })
    vi.stubGlobal('self', {
      importScripts: vi.fn(),
      packing_wasm_bindgen: bindings,
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(manifest))
        .mockResolvedValueOnce(new Response(new Uint8Array([1]))),
    )
    await expect(loadWasmPacking(url)).rejects.toThrow('version mismatch')
  })
})
