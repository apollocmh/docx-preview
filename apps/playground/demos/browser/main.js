// Online preview demo: the canonical WPS-style viewer (apps/viewer) with the
// site's sample document preloaded. The viewer DOM is injected from
// viewer.html's raw markup so the markup has a single source of truth
// (script tags injected via innerHTML are inert — viewer.js is imported
// explicitly below after the DOM exists, since it queries elements at init).
import viewerHtml from '#viewer/viewer.html?raw';

const base = import.meta.env.BASE_URL;

document.body.innerHTML = viewerHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

// Default document: the site's bundled sample (?file= still overrides it,
// handled by the viewer itself).
document.body.dataset.defaultFile = `${base}demo.docx`;

// Webfont manifest: font file URLs in font.json are root-absolute
// (url('/fonts/...')), so rewrite them against the site base and hand the
// viewer a rewritten copy as a blob URL.
const fonts = await fetch(`${base}fonts/font.json`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
if (Array.isArray(fonts) && fonts.length) {
  const rewritten = fonts.map((f) => ({
    ...f,
    src: String(f.src).replace(/url\('\//g, `url('${base}`),
  }));
  document.body.dataset.fontsUrl = URL.createObjectURL(
    new Blob([JSON.stringify(rewritten)], { type: 'application/json' }),
  );
}

await import('#viewer/viewer.js').catch((err) => {
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#b91c1c;padding:16px;white-space:pre-wrap';
  pre.textContent = String((err && err.stack) || err);
  document.body.appendChild(pre);
});
