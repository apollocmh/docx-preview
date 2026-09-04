import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const appRoot = dirname(fileURLToPath(import.meta.url));

// Builds ONLY the browser demo (the apps/viewer WPS-style viewer preloaded
// with the site sample) merged into the VitePress output (.vitepress/dist)
// after `vitepress build` — see the package.json build script. VitePress
// itself owns the docs pages and never loads this file (vite.configFile:
// false in .vitepress/config.ts).
//
// The core library is aliased to its SOURCE so renderer edits hot-reload
// in dev and ship from a single code path in the Pages deployment.
export default defineConfig({
  root: appRoot,
  // Same base in dev and prod (GitHub Pages subpath) so import.meta.env.BASE_URL
  // and the VitePress dev proxy (5174 -> 5173) line up without rewrites.
  base: '/docx-preview/',
  resolve: {
    alias: {
      '@apollo-design/docx-preview': resolve(appRoot, '../../packages/docx-preview/src/docx-preview.ts'),
      // The canonical viewer lives in apps/viewer; alias it because plain
      // ../../ imports outside the Vite root fail to resolve in build.
      '#viewer': resolve(appRoot, '../viewer'),
    },
  },
  build: {
    outDir: resolve(appRoot, '.vitepress/dist'),
    emptyOutDir: false, // vitepress build ran first and owns the directory
    target: 'es2022', // demos use top-level await; viewer-grade chrome76 not needed here
    rollupOptions: {
      input: {
        'demos/browser': resolve(appRoot, 'demos/browser/index.html'),
      },
    },
  },
});
