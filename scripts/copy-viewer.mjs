// Copies the standalone viewer into dist/, so dist/viewer.html works as-is
// when served statically or opened from the filesystem.
//
// Release hardening: viewer.js is minified/mangled with terser (Chrome 76
// output target), and viewer.html is rewritten to load the minified UMD
// build (docx-preview.min.js) when it exists — plain `npm run build` only
// produces the dev UMD, so the reference stays untouched in that case.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await mkdir(dist, { recursive: true });

const files = [
  // Optional webfont manifest consumed by viewer.js; edit to match the fonts
  // available on your server.
  ['viewer/fonts.json', 'fonts.json'],
  // docx-preview's UMD build resolves jszip through the global `JSZip`; ship
  // the official browser build next to it so the viewer needs no CDN.
  ['node_modules/jszip/dist/jszip.min.js', 'jszip.min.js'],
];

for (const [from, to] of files) {
  await copyFile(resolve(root, from), resolve(dist, to));
  console.log(`copied ${from} -> dist/${to}`);
}

// viewer.html: swap the dev UMD for the minified build when available.
let html = await readFile(resolve(root, 'viewer/viewer.html'), 'utf8');
if (existsSync(resolve(dist, 'docx-preview.min.js'))) {
  html = html.replace('./docx-preview.js', './docx-preview.min.js');
}
await writeFile(resolve(dist, 'viewer.html'), html);
console.log('copied viewer/viewer.html -> dist/viewer.html');

// viewer.js: minify + mangle (ecma 2015 output is safe for Chrome 76+).
const viewerJs = await readFile(resolve(root, 'viewer/viewer.js'), 'utf8');
const minified = await minify(viewerJs, {
  compress: { ecma: 2015 },
  mangle: true,
  format: { ecma: 2015, comments: false },
});
if (!minified.code) throw new Error('terser produced no output for viewer.js');
await writeFile(resolve(dist, 'viewer.js'), minified.code);
console.log(
  `minified viewer/viewer.js -> dist/viewer.js (${viewerJs.length} -> ${minified.code.length} bytes)`,
);

// viewer.css: copy as-is (small, and comments document the Chrome 76
// constraints for future editors).
await copyFile(resolve(root, 'viewer/viewer.css'), resolve(dist, 'viewer.css'));
console.log('copied viewer/viewer.css -> dist/viewer.css');
