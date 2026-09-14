import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

const pkgRoot = dirname(fileURLToPath(import.meta.url))

const externals = ['vue', '@apollo-design/docx-preview', 'jszip']

const sharedOutput = {
  globals: {
    vue: 'Vue',
    '@apollo-design/docx-preview': 'docx',
  },
}

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      tsconfigPath: resolve(pkgRoot, 'tsconfig.app.json'),
    }),
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
    // 标准 vite 走这个
    rollupOptions: {
      external: externals,
      output: sharedOutput,
    },
    // rolldown-vite 走这个；标准 vite 会忽略，无害
    rolldownOptions: {
      external: externals,
      output: sharedOutput,
    },
  },
})
