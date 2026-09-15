import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
// @ts-ignore
import tailwindcss from '@tailwindcss/vite'

const BASE = '/docx-preview/'

// Dev: docs run on 5174, demos on 15175 (vite.config.ts / `pnpm dev:demos`).
// The demos must keep ONE module graph: the library sources live outside the
// docs root, so they are loaded through `@fs` URLs, and whoever transforms them
// decides which `vue` / `react` they import. Left to this server they'd pull in
// the docs' own optimized copy, so a proxied demo page would run two framework
// instances (Vue: `Cannot read properties of null (reading 'ce')` from
// renderSlot; React: "Invalid hook call"). Forward those `@fs` paths — and the
// demo HTML/modules themselves — to the demo server instead.
const DEMO_DEV_ORIGIN = process.env.DEMO_DEV_ORIGIN || 'http://localhost:15175'
const WORKSPACE_ROOT = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\\/g, '/')
const PACKAGES_FS = `${BASE}@fs/${WORKSPACE_ROOT.replace(/\/$/, '')}/packages/`

// Documentation + demo hub for https://apollocmh.github.io/docx-preview/.
// Docs pages are plain VitePress; the three viewer demos are separate Vite
// MPA entries (see vite.config.ts) merged into the same dist after build.
export default defineConfig({
  title: 'docx-preview',
  description:
    'Render DOCX documents as semantic HTML — core library plus Browser / Vue / React viewers',
  base: BASE,
  lang: 'zh-CN',
  cleanUrls: true,
  srcExclude: ['prompt.md', 'demos/**'],
  // Demos are built by `vite build` AFTER `vitepress build` into the same
  // dist, so they don't exist during the docs dead-link check.
  ignoreDeadLinks: [/^\/demos\//],

  vite: {
    // CRITICAL: stop VitePress from loading ./vite.config.ts (the demos MPA
    // build config). Without this its publicDir/emptyOutDir/input settings
    // leak into the docs build — public/ never gets copied and demos get
    // built twice with clashing inputs.
    configFile: false,
    plugins: [tailwindcss()],
    // Dev only — `server.proxy` is not used by `vitepress preview` or the build.
    server: {
      proxy: {
        // The demo pages and their own modules.
        '/docx-preview/demos/': { target: DEMO_DEV_ORIGIN, changeOrigin: false },
        // Workspace library sources (`@fs` URLs): same transformer as the demos,
        // so both sides resolve to the demo server's `vue` / `react`.
        [PACKAGES_FS]: { target: DEMO_DEV_ORIGIN, changeOrigin: false },
        // The demo server's pre-bundled deps (`vue`, `react`, `jszip`, …). These
        // files import each other, and the rewriting is per-server, so serving
        // them from here would hand out a second `react`/`vue` copy.
        // (The docs' own deps live in .vitepress/cache/deps — untouched.)
        [`${BASE}node_modules/.vite/`]: { target: DEMO_DEV_ORIGIN, changeOrigin: false },
      },
    },
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '文档', link: '/docs/' },
      {
        text: '在线 Demo',
        // No BASE prefix: VitePress applies base to internal links itself
        // (writing it here would produce /docx-preview/docx-preview/...).
        items: [
          { text: 'Browser 原生', link: '/demos/browser/', target: '_blank' },
          { text: 'vue', link: '/demos/vue/', target: '_blank' },
          { text: 'react', link: '/demos/react/', target: '_blank' },
          { text: 'svelte', link: '/demos/svelte/', target: '_blank' },
        ],
      },
      { text: 'npm', link: 'https://www.npmjs.com/package/@apollo-design/docx-preview' },
    ],

    sidebar: {
      '/docs/': [
        {
          text: '指南',
          items: [
            { text: '介绍', link: '/docs/' },
            { text: '快速开始', link: '/docs/getting-started' },
            { text: '查看器组件', link: '/docs/viewers' },
            { text: 'API 参考', link: '/docs/api' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/apollocmh/docx-preview' }],

    footer: {
      message:
        'Based on <a href="https://github.com/VolodymyrBaydalka/docxjs">docxjs</a> by Volodymyr Baydalka',
      copyright: 'Apache-2.0 License · Copyright apollocmh',
    },
  },
})
