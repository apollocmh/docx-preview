# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

# docx-preview (fork)

Fork of VolodymyrBaydalka/docxjs (origin: github.com/apollocmh/docx-preview). Default branch: **master**. npm (package-lock.json is committed — the upstream `/*.json` gitignore rule has a `!package-lock.json` negation; keep it).

## Attention

- Temporary plan/analysis output goes to `docs/agent-tmp/` unless a specific path is given.
- Do NOT run or write unit tests / test suites for verification — the maintainer verifies changes manually. Skip TDD unless explicitly asked.
- Work fast and lean: prefer direct answers and minimal verification steps.

## Tech Stack

- TypeScript + Rollup 4, npm. Runtime dependency: jszip only (external, global `JSZip` in UMD).
- Public API (`src/docx-preview.ts`): `renderAsync(data, bodyContainer, styleContainer?, options?)` (stable), `parseAsync`, `renderDocument`, `defaultOptions`. Styles are JS-generated `<style>` nodes appended to styleContainer — there is no library CSS file.
- `dist/docx-preview.d.ts` is a **hand-maintained stub**, not generated (tsconfig has noEmit) — update it when the public API changes.

## Build & Dist

dist/ is committed to git.

- `npm run build` — dev UMD only (upstream semantic, unchanged)
- `npm run build-prod` — all four artifacts: `docx-preview.js` / `.min.js` (UMD, global `docx`) + `.mjs` / `.min.mjs`
- `npm run build:viewer` — copies `viewer/*` + `node_modules/jszip/dist/jszip.min.js` into dist/
- `npm run build:release` — build-prod + viewer (what CI runs)
- `npm run test:package` — contract gate (UMD syntax, exports, viewer files)

Gotchas:

- Legacy justify: WPS-authored docs with `compatibilityMode ≤ 11` (Word 2003 rules, settings.xml) expand space runs on the last line of justified paragraphs (密级…发文字号 header lines). The renderer emulates this with `text-align-last: justify`, applied per-paragraph in renderParagraph only when the paragraph's effective align is justify AND its text contains an interior 2+-space gap — otherwise every justified body paragraph's last line would be stretched.
- UMD outputs are Babel-downleveled via `getBabelOutputPlugin` (output-level, Chrome 76 / FF 78 / Safari 13 / Edge 79 targets, `modules: false`) — viewer embedding targets legacy browsers. The `.mjs` artifacts keep ES2020 syntax.
- Terser folds `cond ? .5 : 1` into `cond?.5:1` — the `?.` contract check must use `/\?\.(?!\d)/` to avoid false positives.

## Viewer (viewer/ → dist/)

Chromeless iframe-embeddable reader: `viewer.html?file=<url>[&scale=fit|75|0.75][&thumbs=1|0][&filename=<name>]`. WPS-style toolbar (pager, zoom, download); toolbar shows only after a successful load; zoom is instant pure CSS transform on `.docx-wrapper` (no re-render). Chrome 76 classic-script constraints apply (no `?.`/`??`/inset/flex-gap/aspect-ratio).

- Only OOXML zip packages are renderable; OLE2 binaries (old .doc, and .wps — still the default even for modern WPS Office) are detected by magic bytes (D0 CF 11 E0) in openBuffer and get a targeted "save as .docx" error instead of a JSZip failure.

- Renders with `paginate: true` — content is re-flowed into page-sized sections by `src/pagination.ts` (post-render DOM pass: tables split by row, paragraphs by line via Range rects; continuation fragments get a `docx-continuation` class that suppresses indent/list markers). The library waits for `document.fonts.ready` before measuring.
- Fonts: optional `fonts.json` next to viewer.html (`[{name, src, weight?, style?}]`, injected as `@font-face` via the library `fonts` option) — tier order: docx-embedded fonts > fonts.json > system fonts.
- fit mode = fit-width capped at 100% of natural width (never upscales).
- Thumbnail sidebar (`#thumbs`): deep clones of page sections shrunk with CSS transform (no canvas/re-render). Clones live outside `.docx-wrapper`, so list markers must be suppressed in CSS (`.thumbs .docx p::before`) — CSS counters keep incrementing across clones and would show wrong numbers. `buildThumbs()` must call `syncThumbs()` itself; `applyScale()` runs before the thumbnails exist.
- Page chrome: four Office-style crop marks are real `<i class="page-corner tl|tr|bl|br">` elements appended by viewer.js — joints sit exactly on the text-area (padding) corners, arms reach into the margins; viewer.js computes position/size inline from each section's computed padding (size = min(paddings) × 0.25), CSS carries only border orientation; the weakened box-shadow override lives in viewer.css scoped as `.document .docx-wrapper > section.docx` — specificity must beat the library's injected `.docx-wrapper>section.docx` style, which lands later in the cascade.
- Sidebar toggle: toolbar `#toggle-thumbs` flips `thumbsVisible`; `applyThumbsVisibility()` is the single place that decides `#thumbs.hidden` + button `active` (hidden when !docLoaded or ≤1 page). Toggling changes stage width — must re-`applyScale()` when scaleMode is 'fit'.
- Pages = `.docx-wrapper > section` elements; pager hidden when only one.
- Natural width = widest section's offsetWidth — the wrapper is a full-width block, its own width is the container's, never measure it for the document width.
- Zoom stepping snaps to the 0.25 grid with an epsilon tolerance (`|steps - round(steps)| < 0.01`) before stepping ±1 — bare floor/ceil on sub-pixel measurements makes the buttons no-op.

## CI / Release

`.github/workflows/release.yml`: push to master refreshes the rolling `latest` prerelease; `v*` tags publish a stable release (tag must equal package.json version). Uses `npm ci` — package-lock.json must stay committed. `.github/workflows/webpack.yml` is the legacy upstream CI, left untouched.
