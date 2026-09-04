// Post-build contract check (run by `pnpm test`, after the lib build).
// Only project-unique contracts live here — packaging/file-list verification
// is delegated to `npm pack` (see the Release workflow).
//
// - UMD artifacts are served to legacy embedders (Chrome 76 class) and must
//   stay free of ES2020 operators; jszip must remain an external global.
// - The ES entry must import cleanly and expose the stable public API.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// `?.` followed by a digit is a minified ternary (`cond ? .5 : 1` →
// `cond?.5:1`), not optional chaining — chaining never takes that form.
const OPTIONAL_CHAINING = /\?\.(?!\d)/;

for (const fileName of ['docx-preview.js', 'docx-preview.min.js']) {
	const code = await readFile(new URL(`../dist/${fileName}`, import.meta.url), 'utf8');
	assert.equal(OPTIONAL_CHAINING.test(code), false, `${fileName}: optional chaining (?.) leaked`);
	assert.equal(code.includes('??'), false, `${fileName}: nullish coalescing (??) leaked`);
	assert.equal(code.includes('JSZip'), true, `${fileName}: jszip must stay an external global`);
}

const esm = await import(new URL('../dist/docx-preview.mjs', import.meta.url));
assert.equal(typeof esm.renderAsync, 'function', 'mjs entry does not export renderAsync');
assert.equal(typeof esm.parseAsync, 'function', 'mjs entry does not export parseAsync');
assert.equal(typeof esm.defaultOptions, 'object', 'mjs entry does not export defaultOptions');

// The require entry is the same UMD with a .cjs extension (the package is
// type:module, so a .js require target would be loaded as ESM and lose its
// CJS exports).
const cjs = (await import('node:module')).createRequire(import.meta.url)('../dist/docx-preview.cjs');
assert.equal(typeof cjs.renderAsync, 'function', 'cjs entry does not export renderAsync');
assert.equal(typeof cjs.defaultOptions, 'object', 'cjs entry does not export defaultOptions');

console.log('dist contract OK (UMD legacy syntax, JSZip global, ESM + CJS entries)');
