import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const version = '0.2.129'
const manifest = path.join(root, 'rust/packing-core/Cargo.toml')
const toolRoot = path.join(root, '.tools/wasm-bindgen')
const binary = path.join(
  toolRoot,
  'bin',
  process.platform === 'win32' ? 'wasm-bindgen.exe' : 'wasm-bindgen',
)
const generated = path.join(root, 'rust/packing-core/target/bindings')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${command} exited with status ${result.status}`)
}

const installed = spawnSync(binary, ['--version'], { encoding: 'utf8' })
if (
  installed.status !== 0 ||
  installed.stdout.trim() !== `wasm-bindgen ${version}`
) {
  run('cargo', [
    'install',
    'wasm-bindgen-cli',
    '--version',
    version,
    '--locked',
    '--root',
    toolRoot,
  ])
}
run('cargo', [
  'build',
  '--manifest-path',
  manifest,
  '--locked',
  '--release',
  '--target',
  'wasm32-unknown-unknown',
])
run(binary, [
  path.join(
    root,
    'rust/packing-core/target/wasm32-unknown-unknown/release/packing_core.wasm',
  ),
  '--target',
  'no-modules',
  '--out-name',
  'packing_core',
  '--out-dir',
  generated,
])

const glue = Buffer.concat([
  await readFile(path.join(generated, 'packing_core.js')),
  Buffer.from('\nglobalThis.packing_wasm_bindgen = wasm_bindgen;\n'),
])
const wasm = await readFile(path.join(generated, 'packing_core_bg.wasm'))
const hash = createHash('sha256')
  .update(glue)
  .update(wasm)
  .digest('hex')
  .slice(0, 16)
const publicDir = path.join(root, 'public/wasm')
const glueFile = `packing_core-${hash}.js`
const wasmFile = `packing_core-${hash}.wasm`
await mkdir(publicDir, { recursive: true })
await writeFile(path.join(publicDir, glueFile), glue)
await writeFile(path.join(publicDir, wasmFile), wasm)
await writeFile(
  path.join(publicDir, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      coreVersion: '0.1.0',
      glueFile,
      wasmFile,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Rust WASM: ${wasmFile} (${(wasm.length / 1024).toFixed(1)} KiB)`)
