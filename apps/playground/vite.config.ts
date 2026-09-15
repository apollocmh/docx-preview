import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const appRoot = dirname(fileURLToPath(import.meta.url))

// Builds ONLY the browser demo (the apps/viewer WPS-style viewer preloaded
// with the site sample) merged into the VitePress output (.vitepress/dist)
// after `vitepress build` — see the package.json build script. VitePress
// itself owns the docs pages and never loads this file (vite.configFile:
// false in .vitepress/config.ts).
//
// Workspace packages are consumed through their `exports["."]["development"]`
// condition, which points at each package's src/ — so edits under
// packages/*/src hot-reload here without any alias. In `vite build` the
// `development` condition drops out and the packages resolve to their
// dist/ output, which is what the deployed site should use.
export default defineConfig({
  root: appRoot,
  // Same base in dev and prod (GitHub Pages subpath) so import.meta.env.BASE_URL
  // and the VitePress dev proxy (5174 -> 5173) line up without rewrites.
  base: '/docx-preview/',
  plugins: [vue(), svelte(), tailwindcss()],
  resolve: {
    // Only the intra-app `#viewer` alias is needed — it points at a sibling
    // directory, which npm resolution can't express.
    //
    // The subpath rule must come first: `#viewer/viewer.html?raw` carries a
    // query string, so `resolve()` cannot be used for the whole replacement
    // (it would treat `$1` as a literal segment). Resolve the directory, then
    // append `$1` so the regex engine expands it after resolution.
    alias: [
      { find: /^#viewer\/(.+)$/, replacement: resolve(appRoot, '../viewer') + '/$1' },
      { find: /^#viewer$/, replacement: resolve(appRoot, '../viewer') },
    ],
  },
  optimizeDeps: {
    // Keep workspace packages out of the pre-bundle step; otherwise Vite
    // bundles their `import` condition (dist/) and the `development`
    // condition never gets a chance to point at src/.
    exclude: [
      '@apollo-design/docx-preview',
      '@apollo-design/react-docx-preview',
      '@apollo-design/vue-docx-preview',
      '@apollo-design/svelte-docx-preview',
    ],
  },
  build: {
    outDir: resolve(appRoot, '.vitepress/dist'),
    emptyOutDir: false, // vitepress build ran first and owns the directory
    target: 'es2022', // demos use top-level await; viewer-grade chrome76 not needed here
    rollupOptions: {
      input: {
        'demos/browser': resolve(appRoot, 'demos/browser/index.html'),
        'demos/react': resolve(appRoot, 'demos/react/index.html'),
        'demos/svelte': resolve(appRoot, 'demos/svelte/index.html'),
        'demos/vue': resolve(appRoot, 'demos/vue/index.html'),
      },
    },
  },
})
