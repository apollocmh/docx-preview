// Vite 8 config for the standalone viewer app (dev server + production build).
//
// Dev:   pnpm dev           → http://localhost:5173/viewer.html?file=./tmp/test.docx
// Build: pnpm build:viewer  → apps/viewer/dist/viewer.html + dist/<version>/
//                             iie-preview-docx-viewer.min.{js,css}
//
// The viewer bundles jszip and the docx-preview library SOURCE directly
// (aliased to packages/docx-preview/src so dev edits hot-reload), producing
// a single self-contained script per release, versioned by the library
// package version for cache-friendliness.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, '../..');
const version = JSON.parse(
	readFileSync(resolve(repoRoot, 'packages/docx-preview/package.json'), 'utf8'),
).version;

export default defineConfig({
	root: appRoot,
	base: './',
	input: 'viewer.html',
	resolve: {
		alias: {
			'@apollo-design/docx-preview': resolve(repoRoot, 'packages/docx-preview/src/docx-preview.ts'),
		},
	},
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
		outDir: 'dist',
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
