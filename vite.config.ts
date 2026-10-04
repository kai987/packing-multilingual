import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const githubPagesBase = (() => {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '/'
  }

  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  return repoName ? `/${repoName}/` : '/'
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: githubPagesBase,
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@react-three/drei')) {
            return 'drei'
          }

          if (id.includes('@react-three/fiber')) {
            return 'r3f'
          }

          if (id.includes('three-stdlib') || id.includes('three/examples')) {
            return 'three-stdlib'
          }

          if (id.includes('/three/')) {
            // Preserve Three.js's core/renderer boundary instead of merging both.
            return id.includes('/build/three.module')
              ? 'three-renderer'
              : 'three-core'
          }
        },
      },
    },
  },
})
