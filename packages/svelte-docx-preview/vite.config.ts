import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import dts from 'vite-plugin-dts'

const pkgRoot = dirname(fileURLToPath(import.meta.url))

// The Svelte runtime is provided by the host app (peerDependency), so nothing
// under `svelte/` may be bundled — same rule as react/vue staying external.
const external = (id: string) =>
  id === 'svelte' ||
  id.startsWith('svelte/') ||
  id === '@apollo-design/docx-preview' ||
  id === 'jszip'

export default defineConfig({
  plugins: [
    svelte(),
    dts({ include: ['src'], outDirs: 'dist', tsconfigPath: resolve(pkgRoot, 'tsconfig.app.json') }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: resolve(pkgRoot, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'style',
    },
    rolldownOptions: {
      external,
    },
  },
})
