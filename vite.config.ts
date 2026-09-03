// Vite 8 config for the standalone viewer app (dev server + production build).
//
// Dev:    npm run dev          → http://localhost:5173/viewer.html?file=./tmp/test.docx
// Build:  npm run build:viewer → viewer-dist/viewer.html (minified, asset
//                                refs rewritten) + viewer-dist/<version>/
//                                iie-preview-docx-viewer.min.{js,css}
// viewer-dist/ is a build artifact and is NOT committed; the Release workflow
// zips it as the standalone distribution, the Pages workflow deploys it.
//
// The viewer bundles jszip and the docx-preview library SOURCE directly
// (viewer/viewer.js imports ../src/docx-preview), so the published viewer
// package is a single self-contained classic script per release, versioned
// by directory for cache-friendliness. The library build itself lives in
// scripts/build-lib.mjs (programmatic multi-target matrix, no config file).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;

export default defineConfig({
	root: 'viewer',
	base: './',
	input: 'viewer.html',
	plugins: [
		{
			// Vite doesn't minify HTML; do it here for our controlled page
			// (no <pre>/<textarea>, SVG whitespace is insignificant).
			name: 'minify-viewer-html',
			apply: 'build',
			enforce: 'post',
			generateBundle(_, bundle) {
				for (const item of Object.values(bundle)) {
					if (item.type !== 'asset' || !item.fileName.endsWith('.html')) continue;
					item.source = String(item.source)
						.replace(/<!--[\s\S]*?-->/g, '')
						.replace(/>\s+</g, '><')
						.replace(/^\s+/gm, '')
						.replace(/\n{2,}/g, '\n')
						.trim();
				}
			},
		},
	],
	build: {
		outDir: resolve(root, 'viewer-dist'),
		emptyOutDir: true,
		// The viewer is embedded into legacy webviews; Oxc lowers the bundle
		// (library source included) to Chrome 76 syntax, no polyfills.
		target: 'chrome76',
		modulePreload: { polyfill: false },
		rolldownOptions: {
			output: {
				entryFileNames: `${version}/iie-preview-docx-viewer.min.js`,
				assetFileNames: `${version}/iie-preview-docx-viewer.min[extname]`,
			},
		},
	},
});
