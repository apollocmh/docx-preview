import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

const pkgRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue(), dts({ include: ['src'], outDirs: 'dist', tsconfigPath: resolve(pkgRoot, 'tsconfig.app.json') })],
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
      external: ['vue', '@apollo-design/docx-preview', 'jszip'],
    },
  },
});
