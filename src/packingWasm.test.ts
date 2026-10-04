import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { loadWasmPacking } from '@/packingWasm'

const manifest = {
  schemaVersion: 1,
  bindingFormat: 'esm',
  coreVersion: '0.1.0',
  glueFile: 'packing_core-0123456789abcdef.js',
  wasmFile: 'packing_core-0123456789abcdef.wasm',
}
const url = 'https://example.com/packing-multilingual/wasm/manifest.json'
const request = { products, cartons, cushions, orderLines: defaultOrderLines }
const makeBindings = (version = '0.1.0') => ({
  default: vi.fn().mockResolvedValue({}),
  core_version: () => version,
  recommend_packing_plans: vi.fn().mockReturnValue('{"single":[],"split":[]}'),
})
const stubAssets = () =>
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2]))),
  )
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ESM WASM loader', () => {
  it('imports same-directory hashed assets and calls the limited Rust API', async () => {
    const bindings = makeBindings()
    const importer = vi.fn().mockResolvedValue(bindings)
    stubAssets()
    const calculate = await loadWasmPacking(url, importer)
    expect(calculate(request)).toEqual({ single: [], split: [] })
    expect(bindings.recommend_packing_plans).toHaveBeenCalledWith(
      JSON.stringify(request),
      3,
    )
    expect(importer).toHaveBeenCalledWith(new URL(manifest.glueFile, url).href)
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      new URL(manifest.wasmFile, url).href,
    )
    calculate({
      ...request,
      orderLines: [{ ...defaultOrderLines[0], quantity: Infinity }],
    })
    expect(bindings.recommend_packing_plans).toHaveBeenCalledOnce()
  })
  it.each([
    { ...manifest, glueFile: '../foreign.js' },
    { ...manifest, bindingFormat: 'no-modules' },
    { ...manifest, wasmFile: 'packing_core-fedcba9876543210.wasm' },
  ])('rejects an incompatible manifest', async (invalid) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(invalid)))
    await expect(loadWasmPacking(url)).rejects.toThrow('manifest')
  })
  it('rejects a missing manifest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 })),
    )
    await expect(loadWasmPacking(url)).rejects.toThrow('404')
  })
  it('rejects a missing binary', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(manifest))
        .mockResolvedValueOnce(new Response('', { status: 404 })),
    )
    await expect(loadWasmPacking(url)).rejects.toThrow('binary HTTP 404')
  })
  it('aborts stalled requests after five seconds', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | null | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options: RequestInit) => {
        signal = options.signal
        return new Promise(() => undefined)
      }),
    )
    const assertion = expect(loadWasmPacking(url)).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(signal?.aborted).toBe(true)
  })
  it('also bounds a stalled ESM import', async () => {
    vi.useFakeTimers()
    stubAssets()
    const assertion = expect(
      loadWasmPacking(url, () => new Promise(() => undefined)),
    ).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })
  it('rejects a failed ESM import', async () => {
    stubAssets()
    await expect(
      loadWasmPacking(
        url,
        vi.fn().mockRejectedValue(new Error('module unavailable')),
      ),
    ).rejects.toThrow('module unavailable')
  })
  it('rejects engines with an incompatible version', async () => {
    stubAssets()
    await expect(
      loadWasmPacking(
        url,
        vi.fn().mockResolvedValue(makeBindings('incompatible')),
      ),
    ).rejects.toThrow('version mismatch')
  })
  it('rejects unsupported WebAssembly environments', async () => {
    vi.stubGlobal('WebAssembly', undefined)
    await expect(loadWasmPacking(url)).rejects.toThrow('unavailable')
  })
})
