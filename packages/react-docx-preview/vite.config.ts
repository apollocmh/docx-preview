import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const pkgRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vite 8 (Oxc) compiles TSX with the automatic JSX runtime by default;
  // react/jsx-runtime stays external via the external list below.
  plugins: [dts({ include: ['src'], outDirs: 'dist', tsconfigPath: resolve(pkgRoot, 'tsconfig.app.json') })],
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
      external: ['react', 'react-dom', 'react/jsx-runtime', '@apollo-design/docx-preview', 'jszip'],
    },
  },
});
