// Builds the standalone viewer package into dist/viewer/:
//
//   dist/viewer/viewer.html                                  (minified)
//   dist/viewer/fonts.json                                   (webfont manifest)
//   dist/viewer/<version>/iie-preview-docx-viewer.min.js     (jszip + docx-preview + viewer.js, one bundle)
//   dist/viewer/<version>/iie-preview-docx-viewer.min.css    (minified)
//
// The versioned asset directory keeps the JS/CSS cache-friendly: a new
// package version produces new URLs, while viewer.html can be served with
// no-cache headers.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const outDir = resolve(dist, 'viewer');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const assetsDir = resolve(outDir, version);

const JS_NAME = 'iie-preview-docx-viewer.min.js';
const CSS_NAME = 'iie-preview-docx-viewer.min.css';

await mkdir(assetsDir, { recursive: true });

// Drop the legacy flat layout (dist/viewer.html, dist/viewer.js, …) from
// earlier builds so git sees the move and stale files don't ship.
for (const stale of ['viewer.html', 'viewer.js', 'viewer.css', 'jszip.min.js', 'fonts.json']) {
  await rm(resolve(dist, stale), { force: true });
}

// ── JS bundle ────────────────────────────────────────────────────────────
// docx-preview's UMD build resolves jszip through the global `JSZip` and the
// viewer talks to the UMD global `docx`, so plain concatenation in this
// order is a valid bundle — all three are independent classic scripts.
const libFile = existsSync(resolve(dist, 'docx-preview.min.js'))
  ? 'docx-preview.min.js'
  : 'docx-preview.js';

const viewerJs = await readFile(resolve(root, 'viewer/viewer.js'), 'utf8');
const minifiedViewer = await minify(viewerJs, {
  compress: { ecma: 2015 },
  mangle: true,
  format: { ecma: 2015, comments: false },
});
if (!minifiedViewer.code) throw new Error('terser produced no output for viewer.js');

const parts = [
  await readFile(resolve(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8'),
  await readFile(resolve(dist, libFile), 'utf8'),
  minifiedViewer.code,
];
const bundle = parts.map(p => p.replace(/;?\s*$/, ';')).join('\n');
await writeFile(resolve(assetsDir, JS_NAME), bundle);
console.log(`bundled jszip + ${libFile} + viewer.js -> dist/viewer/${version}/${JS_NAME} (${bundle.length} bytes)`);

// ── CSS ──────────────────────────────────────────────────────────────────
// Hand-rolled minifier, sufficient for our controlled stylesheet: strips
// comments, collapses whitespace, removes spaces around structural
// punctuation. Value-internal spaces are preserved.
let css = await readFile(resolve(root, 'viewer/viewer.css'), 'utf8');
css = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/:\s+/g, ':')
  .replace(/;}/g, '}')
  .trim();
await writeFile(resolve(assetsDir, CSS_NAME), css);
console.log(`minified viewer/viewer.css -> dist/viewer/${version}/${CSS_NAME} (${css.length} bytes)`);

// ── HTML ─────────────────────────────────────────────────────────────────
let html = await readFile(resolve(root, 'viewer/viewer.html'), 'utf8');

html = html.replace(
  /<link rel="stylesheet" href="\.\/viewer\.css" \/>/,
  `<link rel="stylesheet" href="./${version}/${CSS_NAME}" />`,
);
if (!html.includes(CSS_NAME)) throw new Error('viewer.html css reference not found');

html = html.replace(
  /<script src="\.\/jszip\.min\.js"><\/script>[\s\S]*?<script src="\.\/viewer\.js"><\/script>/,
  `<script src="./${version}/${JS_NAME}"></script>`,
);
if (!html.includes(JS_NAME)) throw new Error('viewer.html script block not found');

// Conservative minification: drop comments and inter-tag whitespace (no
// <pre>/<textarea> in this page, SVG whitespace is insignificant).
html = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/>\s+</g, '><')
  .replace(/^\s+/gm, '')
  .replace(/\n{2,}/g, '\n')
  .trim();
await writeFile(resolve(outDir, 'viewer.html'), html);
console.log(`minified viewer/viewer.html -> dist/viewer/viewer.html (${html.length} bytes)`);

// ── Webfont manifest ─────────────────────────────────────────────────────
// Consumed by viewer.js relative to viewer.html, so it stays at the root of
// the viewer package where deployers can edit it.
await copyFile(resolve(root, 'viewer/fonts.json'), resolve(outDir, 'fonts.json'));
console.log('copied viewer/fonts.json -> dist/viewer/fonts.json');
