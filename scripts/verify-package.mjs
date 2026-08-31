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
// Layout: dist/viewer/viewer.html + dist/viewer/<version>/iie-preview-docx-viewer.min.{js,css}

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const VIEWER_JS = 'iie-preview-docx-viewer.min.js';
const VIEWER_CSS = 'iie-preview-docx-viewer.min.css';

for (const fileName of [
  'viewer/viewer.html',
  'viewer/fonts.json',
  `viewer/${pkg.version}/${VIEWER_JS}`,
  `viewer/${pkg.version}/${VIEWER_CSS}`,
]) {
  assert.equal(existsSync(distUrl(fileName)), true, `dist/${fileName} is missing`);
}

const viewerHtml = await readDist('viewer/viewer.html');
assert.equal(
  viewerHtml.includes(`./${pkg.version}/${VIEWER_JS}`),
  true,
  'viewer.html does not reference the versioned JS bundle',
);
assert.equal(
  viewerHtml.includes(`./${pkg.version}/${VIEWER_CSS}`),
  true,
  'viewer.html does not reference the versioned CSS',
);
assert.equal(viewerHtml.includes('<!--'), false, 'dist/viewer/viewer.html is not minified');

// The bundle must contain all three classic scripts in dependency order:
// jszip (global JSZip) -> docx-preview UMD (global docx) -> viewer app.
const bundle = await readDist(`viewer/${pkg.version}/${VIEWER_JS}`);
const iJszip = bundle.indexOf('JSZip');
const iDocx = bundle.indexOf('docx-preview');
const iViewer = bundle.indexOf('error-banner');
assert.equal(iJszip >= 0, true, 'JS bundle is missing jszip');
assert.equal(iDocx >= 0, true, 'JS bundle is missing the docx-preview UMD');
assert.equal(iViewer >= 0, true, 'JS bundle is missing the viewer app');
assert.equal(
  iJszip < iDocx && iDocx < iViewer,
  true,
  'JS bundle scripts are in the wrong order (jszip < docx-preview < viewer required)',
);

const viewerCss = await readDist(`viewer/${pkg.version}/${VIEWER_CSS}`);
assert.equal(viewerCss.includes('/*'), false, 'viewer CSS is not minified');

console.log('Verified UMD/ES library artifacts and the demo viewer package.');
