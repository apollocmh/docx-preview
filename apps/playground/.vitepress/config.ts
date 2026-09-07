import { defineConfig } from 'vitepress';
// @ts-ignore
import tailwindcss from '@tailwindcss/vite';

const BASE = '/docx-preview/';

// Documentation + demo hub for https://apollocmh.github.io/docx-preview/.
// Docs pages are plain VitePress; the three viewer demos are separate Vite
// MPA entries (see vite.config.ts) merged into the same dist after build.
export default defineConfig({
  title: 'docx-preview',
  description: 'Render DOCX documents as semantic HTML — core library plus Browser / Vue / React viewers',
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
    server: {
      // Dev: docs run on 5174, demos on 5173 (pnpm dev:demos) — proxy the
      // demo paths so the nav links work against a single origin.
      proxy: {
        '/docx-preview/demos/': { target: 'http://localhost:5173', changeOrigin: false },
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
        items: [{ text: 'Browser 原生', link: '/demos/browser/', target: '_blank', }],
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
});
