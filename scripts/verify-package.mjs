// Release gate: verifies the dist/ artifacts that the Release workflow ships.
// Run after `npm run build:release`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

function distUrl(fileName) {
  return new URL(`../dist/${fileName}`, import.meta.url);
}

async function readDist(fileName) {
  return readFile(distUrl(fileName), 'utf8');
}

// ── Library artifacts ────────────────────────────────────────────────────

for (const fileName of [
  'docx-preview.js',
  'docx-preview.min.js',
  'docx-preview.mjs',
  'docx-preview.min.mjs',
  'docx-preview.d.ts',
]) {
  assert.equal(existsSync(distUrl(fileName)), true, `dist/${fileName} is missing`);
}

// ── UMD artifacts: legacy-browser syntax contract ────────────────────────

// `?.` immediately followed by a digit is a minified ternary with a
// fractional literal (`cond ? .5 : 1` → `cond?.5:1`), not optional chaining —
// optional chaining never takes that form.
const OPTIONAL_CHAINING = /\?\.(?!\d)/;

for (const fileName of ['docx-preview.js', 'docx-preview.min.js']) {
  const umd = await readDist(fileName);
  assert.equal(
    OPTIONAL_CHAINING.test(umd),
    false,
    `${fileName} still contains optional chaining (?.)`,
  );
  assert.equal(umd.includes('??'), false, `${fileName} still contains nullish coalescing (??)`);
  assert.equal(
    umd.includes('JSZip'),
    true,
    `${fileName} does not reference the JSZip global (jszip must stay an external global)`,
  );
}

// ── ES artifact: entry point smoke test ──────────────────────────────────

const esmModule = await import(distUrl('docx-preview.mjs'));
assert.equal(typeof esmModule.renderAsync, 'function', 'mjs entry does not export renderAsync');
assert.equal(typeof esmModule.parseAsync, 'function', 'mjs entry does not export parseAsync');
assert.equal(
  typeof esmModule.defaultOptions,
  'object',
  'mjs entry does not export defaultOptions',
);

// ── Viewer files ──────────────────────────────────────────────────────────

for (const fileName of ['viewer.html', 'viewer.js', 'viewer.css', 'jszip.min.js']) {
  assert.equal(existsSync(distUrl(fileName)), true, `dist/${fileName} is missing`);
}
const viewerHtml = await readDist('viewer.html');
// copy-viewer rewrites the reference to the minified build when present.
const umdRef = viewerHtml.includes('./docx-preview.min.js')
  ? './docx-preview.min.js'
  : viewerHtml.includes('./docx-preview.js')
    ? './docx-preview.js'
    : null;
assert.equal(umdRef != null, true, 'viewer.html does not reference a UMD artifact');
if (umdRef) {
  assert.equal(
    existsSync(distUrl(umdRef.slice(2))),
    true,
    `viewer.html references ${umdRef} but the file is missing from dist/`,
  );
}
assert.equal(
  viewerHtml.includes('./viewer.js') && viewerHtml.includes('./viewer.css'),
  true,
  'viewer.html must reference viewer.js / viewer.css',
);
assert.equal(
  viewerHtml.includes('./jszip.min.js'),
  true,
  'viewer.html must load jszip.min.js before the UMD artifact',
);

// dist/viewer.js ships minified: no block comments, single-line output.
const viewerJs = await readDist('viewer.js');
assert.equal(viewerJs.includes('/*'), false, 'dist/viewer.js is not minified');

console.log('Verified UMD/ES library artifacts and the demo viewer package.');
