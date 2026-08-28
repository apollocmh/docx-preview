// Copies the standalone viewer (classic HTML/CSS/JS, no bundling needed) and
// the jszip browser build into dist/, so dist/viewer.html works as-is when
// served statically or opened from the filesystem.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await mkdir(dist, { recursive: true });

const files = [
  ['viewer/viewer.html', 'viewer.html'],
  ['viewer/viewer.js', 'viewer.js'],
  ['viewer/viewer.css', 'viewer.css'],
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
