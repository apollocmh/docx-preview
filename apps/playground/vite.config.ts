import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const appRoot = dirname(fileURLToPath(import.meta.url));

// Dev/test playground: renders local .docx files straight from the library
// SOURCE (aliased), so renderer edits hot-reload without a lib build.
export default defineConfig({
	root: appRoot,
	resolve: {
		alias: {
			'@apollo-design/docx-preview': resolve(appRoot, '../../packages/docx-preview/src/docx-preview.ts'),
		},
	},
});
