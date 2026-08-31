/*
 * DOCX Viewer — standalone demo application.
 *
 * Designed for iframe embedding (`<iframe src="viewer.html?file=...">`).
 * WPS-style reading layout: a toolbar (pager, zoom, download) on top and a
 * scrollable document in the main area. The toolbar appears only after a
 * document loads successfully. Documents load only from the `?file=` URL
 * parameter.
 *
 * Uses the library exclusively through the `docx` UMD global exposed by
 * ./docx-preview.js (loaded via a plain <script> tag in viewer.html), so
 * this page runs without any build tooling — including when opened directly
 * from the filesystem.
 */
(function () {
  'use strict';

  // Zoom-button range. Stepping clamps here so a step never strands the
  // buttons in a disabled state.
  var SCALE_MIN = 0.1;
  var SCALE_MAX = 4;
  var SCALE_STEP = 0.25;
  // Fit-width never upscales: a document reads best at its natural size, so
  // on wide screens fit mode stays at 100% instead of blowing the page up to
  // the full stage width (unlike slides, which cap at 75%).
  var FIT_MAX = 1;
  var STAGE_PADDING = 24; // .stage padding on each side, see viewer.css

  var api = window.docx;

  var els = {
    toolbar: document.getElementById('toolbar'),
    toggleThumbs: document.getElementById('toggle-thumbs'),
    pager: document.getElementById('pager'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInput: document.getElementById('page-input'),
    pageTotal: document.getElementById('page-total'),
    zoomOut: document.getElementById('zoom-out'),
    zoomIn: document.getElementById('zoom-in'),
    scaleDisplay: document.getElementById('scale-display'),
    scaleLabel: document.getElementById('scale-label'),
    scaleDropdown: document.getElementById('scale-dropdown'),
    download: document.getElementById('download'),
    errorBanner: document.getElementById('error-banner'),
    errorTitle: document.getElementById('error-title'),
    errorDetail: document.getElementById('error-detail'),
    stage: document.getElementById('stage'),
    thumbs: document.getElementById('thumbs'),
    empty: document.getElementById('empty'),
    loading: document.getElementById('loading'),
    docBox: document.getElementById('document'),
  };

  function errorText(err) {
    if (err && typeof err === 'object' && 'message' in err) return String(err.message);
    return String(err);
  }

  // OLE2 compound-file magic (D0 CF 11 E0 ...): legacy binary documents —
  // old .doc, and .wps as still saved by default even by recent WPS Office.
  // JSZip can only open zip/OOXML packages, so detect this upfront and give
  // a targeted message instead of a cryptic zip error.
  function isLegacyBinary(buffer) {
    if (!buffer || buffer.byteLength < 4) return false;
    var b = new Uint8Array(buffer, 0, 4);
    return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  }

  function showError(title, detail) {
    els.errorTitle.textContent = title;
    els.errorDetail.textContent = detail || '';
    els.errorBanner.hidden = false;
  }

  function hideError() {
    els.errorBanner.hidden = true;
    els.errorTitle.textContent = '';
    els.errorDetail.textContent = '';
  }

  function setLoading(on) {
    els.loading.hidden = !on;
  }

  if (!api || typeof api.renderAsync !== 'function') {
    setLoading(false);
    showError(
      '查看器加载失败',
      '缺少 docx 全局对象。请将 jszip.min.js、docx-preview.js、viewer.js、viewer.css 与 ' +
        'viewer.html 放在一起(dist/ 目录内),并确认所有脚本请求成功。',
    );
    return;
  }

  // ── State ───────────────────────────────────────────────────────────────

  var docUrl = '';
  var docName = '';
  // ?filename= override: media-library URLs often end in an opaque id/hash,
  // so the caller passes the real document name explicitly (used for the
  // download file name and the document title).
  var filenameOverride = '';
  var docLoaded = false;
  var wrapperEl = null; // .docx-wrapper produced by the library
  var sections = []; // one <section> per rendered page
  var naturalWidth = 0; // px at scale 1
  var naturalHeight = 0;
  var currentPage = 0;
  var currentScale = 1; // the scale actually applied to wrapperEl
  var pageObserver = null;
  // 'fit' (适应宽度) or a number like 0.75 / 1.5
  var scaleMode = 'fit';
  // Sidebar visibility is a user preference; a document with a single page
  // never shows it regardless of this flag.
  var thumbsVisible = true;

  // Optional webfont manifest: fonts.json next to viewer.html, an array of
  // { "name": "SimSun", "src": "url(fonts/simsun.woff2) format(\"woff2\")",
  //   "weight": 400, "style": "normal" }. A missing/invalid file just means
  // no external fonts (embedded docx fonts and system fonts still apply).
  var fontsPromise = null;

  function loadExternalFonts() {
    if (!fontsPromise) {
      fontsPromise = fetch(new URL('fonts.json', location.href).href)
        .then(function (response) {
          if (!response.ok) return null;
          return response.json();
        })
        .then(function (list) {
          if (!list || !Array.isArray(list)) return null;
          var valid = list.filter(function (f) {
            return f && typeof f.name === 'string' && typeof f.src === 'string';
          });
          return valid.length > 0 ? valid : null;
        })
        .catch(function () {
          return null; // e.g. opened from the filesystem, or no manifest
        });
    }
    return fontsPromise;
  }

  // ── Thumbnails ────────────────────────────────────────────────────────
  // Each thumbnail is a deep clone of its page section, shrunk with a CSS
  // transform — no re-render, no canvas. Clones live outside .docx-wrapper,
  // so viewer.css suppresses their list markers (CSS counters would keep
  // incrementing across clones and show wrong numbers).

  var THUMB_WIDTH = 96; // matches .thumb-page width in viewer.css
  var thumbPageSynced = -1; // last page scrolled into view in the sidebar

  function buildThumbs() {
    els.thumbs.innerHTML = '';
    thumbPageSynced = -1;
    if (sections.length <= 1 || !naturalWidth) {
      els.thumbs.hidden = true;
      return;
    }    var scale = (THUMB_WIDTH - 2) / naturalWidth; // 2px = .thumb-page borders
    for (var i = 0; i < sections.length; i++) {
      var item = document.createElement('div');
      item.className = 'thumb';
      item.setAttribute('data-page', String(i));

      var page = document.createElement('div');
      page.className = 'thumb-page';
      page.style.height = Math.ceil(sections[i].offsetHeight * scale) + 'px';

      var clone = sections[i].cloneNode(true);
      clone.removeAttribute('data-page');
      clone.style.transform = 'scale(' + scale + ')';
      clone.style.transformOrigin = 'top left';
      page.appendChild(clone);

      var label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = String(i + 1);

      item.appendChild(page);
      item.appendChild(label);
      els.thumbs.appendChild(item);
    }
    applyThumbsVisibility();
    syncThumbs();
  }

  function applyThumbsVisibility() {
    var show = thumbsVisible && sections.length > 1 && docLoaded;
    els.thumbs.hidden = !show;
    els.toggleThumbs.classList.toggle('active', show);
  }

  function syncThumbs() {
    var items = els.thumbs.children;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('current', Number(items[i].getAttribute('data-page')) === currentPage);
    }
    if (!els.thumbs.hidden && thumbPageSynced !== currentPage && items[currentPage]) {
      thumbPageSynced = currentPage;
      items[currentPage].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Chrome (toolbar visibility / button states) ────────────────────────

  function applyChrome() {
    els.toolbar.hidden = !docLoaded;
    els.pager.hidden = sections.length <= 1;

    els.prevPage.disabled = !docLoaded || currentPage <= 0;
    els.nextPage.disabled = !docLoaded || currentPage >= sections.length - 1;
    els.pageTotal.textContent = sections.length > 0 ? String(sections.length) : '–';
    if (document.activeElement !== els.pageInput) {
      els.pageInput.value = sections.length > 0 ? String(currentPage + 1) : '';
    }
    els.download.disabled = !docLoaded;
    els.toggleThumbs.disabled = !docLoaded || sections.length <= 1;

    els.zoomOut.disabled = !docLoaded || currentScale <= SCALE_MIN + 1e-6;
    els.zoomIn.disabled = !docLoaded || currentScale >= SCALE_MAX - 1e-6;

    applyThumbsVisibility();
    syncThumbs();
  }

  function updateScaleUi() {
    els.scaleLabel.textContent =
      scaleMode === 'fit' ? '适应宽度' : Math.round(scaleMode * 100) + '%';
    var options = els.scaleDropdown.querySelectorAll('button');
    for (var i = 0; i < options.length; i++) {
      var value = options[i].getAttribute('data-scale');
      var selected =
        (scaleMode === 'fit' && value === 'fit') ||
        (scaleMode !== 'fit' && value === String(scaleMode));
      options[i].classList.toggle('selected', selected);
    }
  }

  // ── Zoom ────────────────────────────────────────────────────────────────
  // Zoom is pure CSS: the library renders once at natural size, and we scale
  // .docx-wrapper with a transform inside an explicitly-sized box. No async
  // re-render, so the zoom buttons always step from `currentScale` — the
  // value actually on screen.

  function fitScale() {
    if (!naturalWidth) return 1;
    var avail = els.stage.clientWidth - STAGE_PADDING * 2;
    return Math.min(FIT_MAX, avail / naturalWidth);
  }

  function applyScale() {
    if (!docLoaded || !wrapperEl || !naturalWidth) return;

    // Keep the same relative scroll position across the zoom change.
    var maxY = els.stage.scrollHeight - els.stage.clientHeight;
    var maxX = els.stage.scrollWidth - els.stage.clientWidth;
    var ratioY = maxY > 0 ? els.stage.scrollTop / maxY : 0;
    var ratioX = maxX > 0 ? els.stage.scrollLeft / maxX : 0;

    currentScale = scaleMode === 'fit' ? fitScale() : scaleMode;
    els.docBox.style.width = Math.ceil(naturalWidth * currentScale) + 'px';
    els.docBox.style.height = Math.ceil(naturalHeight * currentScale) + 'px';
    // Pin the wrapper to the natural content width so the top-left-origin
    // transform lines up exactly with the zoom box; page sections center
    // inside it via their own margins.
    wrapperEl.style.width = naturalWidth + 'px';
    wrapperEl.style.transform = 'scale(' + currentScale + ')';
    wrapperEl.style.transformOrigin = 'top left';

    var newMaxY = els.stage.scrollHeight - els.stage.clientHeight;
    var newMaxX = els.stage.scrollWidth - els.stage.clientWidth;
    if (newMaxY > 0) els.stage.scrollTop = ratioY * newMaxY;
    if (newMaxX > 0) els.stage.scrollLeft = ratioX * newMaxX;

    updateScaleUi();
    applyChrome();
  }

  function zoomStep(direction) {
    // currentScale carries sub-pixel fit error (e.g. 0.99998); bare
    // floor/ceil on that snaps back onto the current grid line and the zoom
    // appears dead. Snap to the nearest grid line within tolerance first.
    var steps = currentScale / SCALE_STEP;
    var nearest = Math.round(steps);
    if (Math.abs(steps - nearest) < 0.01) steps = nearest;
    var next =
      direction > 0 ? (Math.floor(steps) + 1) * SCALE_STEP : (Math.ceil(steps) - 1) * SCALE_STEP;
    next = Math.round(next * 100) / 100;
    scaleMode = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    applyScale();
  }

  function closeDropdown() {
    els.scaleDropdown.hidden = true;
  }

  // ── Page corners ──────────────────────────────────────────────────────
  // Office/WPS-style crop marks: four L-brackets whose joints sit exactly
  // on the text-area corners (i.e. the page's padding corners), arms
  // reaching back into the margins. Position and size derive from each
  // section's own computed padding, so mixed-margin documents stay
  // coordinated; the wrapper's CSS-transform zoom scales them for free.

  var CORNER_NAMES = ['tl', 'tr', 'bl', 'br'];

  function addPageCorners(section) {
    var cs = getComputedStyle(section);
    var padTop = parseFloat(cs.paddingTop) || 0;
    var padRight = parseFloat(cs.paddingRight) || 0;
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var padLeft = parseFloat(cs.paddingLeft) || 0;
    var right = section.offsetWidth - padRight; // text-area right edge
    var bottom = section.offsetHeight - padBottom; // text-area bottom edge
    var size = Math.max(4, Math.round(Math.min(padTop, padRight, padBottom, padLeft) * 0.25));

    // Each mark's box is placed so its joint corner lands on the text-area
    // corner: tl=┘ (joint bottom-right), tr=└ (bottom-left),
    // bl=┐ (top-right), br=┌ (top-left).
    var boxes = {
      tl: { left: padLeft - size, top: padTop - size },
      tr: { left: right, top: padTop - size },
      bl: { left: padLeft - size, top: bottom },
      br: { left: right, top: bottom },
    };

    for (var i = 0; i < CORNER_NAMES.length; i++) {
      var name = CORNER_NAMES[i];
      var corner = document.createElement('i');
      corner.className = 'page-corner ' + name;
      corner.setAttribute('aria-hidden', 'true');
      corner.style.width = size + 'px';
      corner.style.height = size + 'px';
      corner.style.left = boxes[name].left + 'px';
      corner.style.top = boxes[name].top + 'px';
      section.appendChild(corner);
    }
  }

  // ── Pages ───────────────────────────────────────────────────────────────
  // Instant jumps only (no scroll animation). The corrective scroll uses
  // bounding-rect geometry because the pages live inside a CSS-transformed
  // wrapper: getBoundingClientRect() is the transform-aware measurement.

  function scrollStageTo(element) {
    var paddingTop = parseFloat(getComputedStyle(els.stage).paddingTop) || 0;
    var top =
      els.stage.scrollTop +
      (element.getBoundingClientRect().top - els.stage.getBoundingClientRect().top) -
      paddingTop;
    els.stage.scrollTop = top;
  }

  function goToPage(index) {
    if (!docLoaded || sections.length === 0) return;
    var clamped = Math.max(0, Math.min(index, sections.length - 1));
    currentPage = clamped;
    scrollStageTo(sections[clamped]);
    applyChrome();
  }

  function trackPages() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    if (typeof window.IntersectionObserver !== 'function' || sections.length <= 1) return;

    var ratios = [];
    pageObserver = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var index = Number(entries[i].target.getAttribute('data-page'));
          if (!Number.isNaN(index)) ratios[index] = entries[i].intersectionRatio;
        }
        var bestIndex = -1;
        var bestRatio = -1;
        for (var j = 0; j < ratios.length; j++) {
          if (ratios[j] > bestRatio) {
            bestRatio = ratios[j];
            bestIndex = j;
          }
        }
        if (bestIndex >= 0 && bestRatio > 0 && bestIndex !== currentPage) {
          currentPage = bestIndex;
          applyChrome();
        }
      },
      { root: els.stage, threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    );
    for (var k = 0; k < sections.length; k++) {
      pageObserver.observe(sections[k]);
    }
  }

  // ── Document loading ────────────────────────────────────────────────────

  function resetDocument() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    els.docBox.innerHTML = '';
    els.docBox.style.width = '';
    els.docBox.style.height = '';
    els.thumbs.innerHTML = '';
    els.thumbs.hidden = true;
    thumbPageSynced = -1;
    wrapperEl = null;
    sections = [];
    naturalWidth = 0;
    naturalHeight = 0;
    currentPage = 0;
    docLoaded = false;
  }

  function openBuffer(buffer, label) {
    resetDocument();
    hideError();
    closeDropdown();
    els.empty.hidden = true;
    setLoading(true);

    if (isLegacyBinary(buffer)) {
      setLoading(false);
      els.empty.hidden = false;
      applyChrome();
      showError(
        '无法打开' + (label ? '「' + label + '」' : '文档'),
        '这是旧版二进制文档格式(.wps / .doc),不是 OOXML(.docx)。' +
          '即使是新版 WPS Office,默认保存的 .wps 仍是二进制格式。' +
          '请用 WPS 或 Word 将其另存为 .docx 后重试。',
      );
      return Promise.resolve();
    }

    return loadExternalFonts()
      .then(function (fonts) {
        return api.renderAsync(buffer, els.docBox, undefined, {
          hideWrapperOnPrint: true,
          paginate: true,
          // 'experimental' only gates tab-stop computation, which 公文版记
          // lines (right-aligned tab stops) depend on.
          experimental: true,
          fonts: fonts || undefined,
        });
      })
      .then(function () {
        wrapperEl = els.docBox.querySelector('.docx-wrapper') || els.docBox;

        var found = wrapperEl.querySelectorAll('section');
        sections = [];
        for (var i = 0; i < found.length; i++) {
          found[i].setAttribute('data-page', String(i));
          addPageCorners(found[i]);
          sections.push(found[i]);
        }

        // Natural page size, measured before any transform is applied. The
        // wrapper is a full-width block, so its own width is the stage's —
        // the document's real width is the widest fixed-width page section.
        // Height wraps the stacked content, so the wrapper's own height works.
        naturalWidth = 0;
        for (var j = 0; j < sections.length; j++) {
          naturalWidth = Math.max(naturalWidth, sections[j].offsetWidth);
        }
        if (!naturalWidth) naturalWidth = wrapperEl.scrollWidth;
        naturalHeight = wrapperEl.offsetHeight;

        docLoaded = true;
        currentPage = 0;
        if (docName) document.title = docName;
        applyScale();
        buildThumbs();
        trackPages();
        els.stage.scrollTop = 0;
        els.stage.scrollLeft = 0;
      })
      .catch(function (err) {
        console.error(err);
        resetDocument();
        els.empty.hidden = false;
        applyChrome();
        showError(
          '无法打开' + (label ? '「' + label + '」' : '文档'),
          errorText(err) + ' —— 请确认这是有效且未加密的 .docx 文件。',
        );
      })
      .then(function () {
        setLoading(false);
      });
  }

  function openRemoteFile(fileUrl) {
    hideError();
    els.empty.hidden = true;
    setLoading(true);

    docUrl = fileUrl;
    docName = fileUrl;
    try {
      var parsed = new URL(fileUrl, location.href);
      var tail = parsed.pathname.split('/').pop();
      if (tail) docName = decodeURIComponent(tail);
    } catch (_ignored) {
      /* keep the raw URL as the label */
    }
    if (filenameOverride) docName = filenameOverride;

    fetch(fileUrl, { mode: 'cors', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' ' + response.statusText);
        }
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        return openBuffer(buffer, docName);
      })
      .catch(function (err) {
        setLoading(false);
        els.empty.hidden = false;
        applyChrome();
        if (err instanceof TypeError) {
          // fetch() rejects with a bare TypeError for DNS failures, offline
          // state, mixed-content blocks AND CORS rejections — the browser
          // deliberately does not distinguish them.
          showError(
            '文档下载失败',
            '请求「' +
              fileUrl +
              '」被浏览器拦截或失败。最常见的原因是跨域(CORS)限制:文件服务器未返回允许本页面的 ' +
              'Access-Control-Allow-Origin 响应头;也可能是网络故障或 HTTP/HTTPS 混合内容拦截。' +
              '本查看器不提供代理、不绕过浏览器跨域限制——请让文件服务器开启 CORS 后重试。(' +
              errorText(err) +
              ')',
          );
        } else {
          showError(
            '文档下载失败:「' + docName + '」',
            errorText(err) + '。请确认地址正确且可公开访问。',
          );
        }
      });
  }

  // ── Wiring ──────────────────────────────────────────────────────────────

  els.prevPage.addEventListener('click', function () {
    goToPage(currentPage - 1);
  });

  els.thumbs.addEventListener('click', function (event) {
    var item = event.target.closest('.thumb');
    if (!item) return;
    goToPage(Number(item.getAttribute('data-page')));
  });

  els.toggleThumbs.addEventListener('click', function () {
    thumbsVisible = !thumbsVisible;
    applyThumbsVisibility();
    // The sidebar eats stage width — re-fit so fit-width stays correct.
    if (docLoaded && scaleMode === 'fit') applyScale();
  });

  els.nextPage.addEventListener('click', function () {
    goToPage(currentPage + 1);
  });

  function jumpFromInput() {
    var target = parseInt(els.pageInput.value, 10);
    if (Number.isNaN(target)) {
      els.pageInput.value = sections.length > 0 ? String(currentPage + 1) : '';
      return;
    }
    goToPage(target - 1);
    els.pageInput.blur();
  }

  els.pageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') jumpFromInput();
  });
  els.pageInput.addEventListener('change', jumpFromInput);

  els.zoomOut.addEventListener('click', function () {
    zoomStep(-1);
  });

  els.zoomIn.addEventListener('click', function () {
    zoomStep(1);
  });

  els.scaleDisplay.addEventListener('click', function (event) {
    event.stopPropagation();
    els.scaleDropdown.hidden = !els.scaleDropdown.hidden;
  });

  els.scaleDropdown.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-scale]');
    if (!button) return;
    var value = button.getAttribute('data-scale');
    scaleMode = value === 'fit' ? 'fit' : parseFloat(value);
    closeDropdown();
    applyScale();
  });

  document.addEventListener('click', function (event) {
    if (!els.scaleDropdown.hidden && !event.target.closest('.scale-select')) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeDropdown();

    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      goToPage(currentPage - 1);
    } else if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'PageDown' ||
      event.key === ' '
    ) {
      event.preventDefault();
      goToPage(currentPage + 1);
    } else if (event.key === 'Home') {
      goToPage(0);
    } else if (event.key === 'End') {
      goToPage(sections.length - 1);
    }
  });

  els.download.addEventListener('click', function () {
    if (!docUrl) return;
    var link = document.createElement('a');
    link.href = docUrl;
    link.download = docName || docUrl.split('/').pop() || 'document.docx';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Fit mode follows window resizes; numeric zoom stays absolute.
  window.addEventListener('resize', function () {
    if (docLoaded && scaleMode === 'fit') applyScale();
  });

  // ── Boot ────────────────────────────────────────────────────────────────

  var params = new URLSearchParams(location.search);

  // Optional initial zoom: ?scale=fit | ?scale=75 | ?scale=0.75
  // (numbers > 10 are treated as percent; clamped to 10%–400%).
  // fit mode = fit-width capped at 100% of natural size; a number = absolute
  // percent of natural size that does not follow window resizes.
  (function initScaleFromUrl() {
    var raw = params.get('scale');
    if (!raw || raw === 'fit' || raw === 'auto') return;
    var n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n > 10) n = n / 100;
    scaleMode = Math.max(0.1, Math.min(4, Math.round(n * 100) / 100));
  })();

  // Optional initial sidebar state: ?thumbs=1 (default) | ?thumbs=0
  (function initThumbsFromUrl() {
    var raw = params.get('thumbs');
    if (raw === '0' || raw === 'false' || raw === 'hide') thumbsVisible = false;
  })();

  // ?filename=<name>: explicit document name for download/title when the
  // file URL is an opaque media-library address.
  filenameOverride = params.get('filename') || '';

  updateScaleUi();
  applyChrome();

  var fileParam = params.get('file');
  if (fileParam) {
    openRemoteFile(fileParam);
  }
})();
