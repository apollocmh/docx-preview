// Core viewer logic, ported from apps/viewer/viewer.js. UI-facing values are
// React state; everything else (library render output, thumbnail clones, page
// corners, zoom transforms) is imperative DOM work against element refs.
// A ref mirror (stateRef) lets the once-registered global listeners read
// fresh values.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { renderAsync } from '@apollo-design/docx-preview';
import type { Options } from '@apollo-design/docx-preview';

// Zoom-button range. Stepping clamps here so a step never strands the
// buttons in a disabled state.
const SCALE_MIN = 0.1;
const SCALE_MAX = 4;
const SCALE_STEP = 0.25;
// Fit-width never upscales: a document reads best at its natural size.
const FIT_MAX = 1;
const STAGE_PADDING = 24; // .stage padding on each side, see viewer.css
const THUMB_WIDTH = 96; // matches .thumb-page width in viewer.css
const CORNER_NAMES = ['tl', 'tr', 'bl', 'br'] as const;

export interface DocxViewerRefs {
  stage: RefObject<HTMLElement | null>;
  docBox: RefObject<HTMLElement | null>;
  thumbs: RefObject<HTMLElement | null>;
}

export interface DocxViewerOptions {
  /** 'fit' (fit-width, never upscales) or a number like 0.75 / 75 */
  initialScale?: 'fit' | number;
  /** initial thumbnail sidebar visibility (default true) */
  showThumbs?: boolean;
  /** library render options, merged over { hideWrapperOnPrint, paginate, experimental } */
  renderOptions?: Partial<Options>;
  onRendered?: (result: unknown) => void;
  onError?: (error: unknown) => void;
}

// OLE2 compound-file magic (D0 CF 11 E0 ...): legacy binary documents —
// old .doc, and .wps as still saved by default even by recent WPS Office.
function isLegacyBinary(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
}

function errorText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as Error).message);
  return String(err);
}

/** 自定义文档请求(可附加鉴权头等),返回文档数据 */
export type DocxCustomRequest = (url: string) => Promise<Blob | ArrayBuffer | Uint8Array | null>;

// Download-button fallback name: last path segment of the URL.
function nameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    return (last && decodeURIComponent(last)) || 'document.docx';
  } catch {
    return 'document.docx';
  }
}

function initialScaleMode(value: 'fit' | number | undefined): 'fit' | number {
  if (typeof value === 'number' && isFinite(value) && value > 0) {
    const n = value > 10 ? value / 100 : value;
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n * 100) / 100));
  }
  return 'fit';
}

export function useDocViewer(refs: DocxViewerRefs, options: DocxViewerOptions = {}) {
  // ── UI state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [currentScale, setCurrentScale] = useState(1);
  const [scaleMode, setScaleMode] = useState<'fit' | number>(() => initialScaleMode(options.initialScale));
  const [thumbsVisible, setThumbsVisible] = useState(options.showThumbs !== false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ── Mutable internals (live DOM produced by the library) ───────────────
  const it = useRef({
    docName: '',
    // The opened document kept as a Blob so the download button works
    // regardless of the input type (Blob / ArrayBuffer / Uint8Array).
    docBlob: null as Blob | null,
    wrapperEl: null as HTMLElement | null,
    sections: [] as HTMLElement[],
    naturalWidth: 0,
    naturalHeight: 0,
    currentPage: 0, // authoritative copy (state mirrors it for rendering)
    pageObserver: null as IntersectionObserver | null,
    thumbPageSynced: -1,
  });
  // Latest-value mirror for the once-registered global listeners.
  const stateRef = useRef({ docLoaded, currentPage, scaleMode, thumbsVisible, currentScale });
  stateRef.current = { docLoaded, currentPage, scaleMode, thumbsVisible, currentScale };
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pagerShown = pageCount > 1;
  const thumbsShown = thumbsVisible && pageCount > 1 && docLoaded;
  const canPrev = docLoaded && currentPage > 0;
  const canNext = docLoaded && currentPage < pageCount - 1;
  const canZoomOut = docLoaded && currentScale > SCALE_MIN + 1e-6;
  const canZoomIn = docLoaded && currentScale < SCALE_MAX - 1e-6;
  const scaleLabel = scaleMode === 'fit' ? '适应宽度' : Math.round(scaleMode * 100) + '%';

  // ── Thumbnails ─────────────────────────────────────────────────────────
  // Deep clones of page sections shrunk with a CSS transform — no re-render.

  function syncThumbs() {
    const box = refs.thumbs.current;
    if (!box) return;
    const items = box.children;
    const page = it.current.currentPage;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('current', Number(items[i].getAttribute('data-page')) === page);
    }
    const shown = stateRef.current.thumbsVisible && items.length > 1 && stateRef.current.docLoaded;
    if (shown && it.current.thumbPageSynced !== page && items[page]) {
      it.current.thumbPageSynced = page;
      (items[page] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }

  function buildThumbs() {
    const box = refs.thumbs.current;
    if (!box) return;
    box.innerHTML = '';
    it.current.thumbPageSynced = -1;
    const sections = it.current.sections;
    if (sections.length <= 1 || !it.current.naturalWidth) return;

    const scale = (THUMB_WIDTH - 2) / it.current.naturalWidth; // 2px = .thumb-page borders
    for (let i = 0; i < sections.length; i++) {
      const item = document.createElement('div');
      item.className = 'thumb';
      item.setAttribute('data-page', String(i));

      const page = document.createElement('div');
      page.className = 'thumb-page';
      page.style.height = Math.ceil(sections[i].offsetHeight * scale) + 'px';

      const clone = sections[i].cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-page');
      clone.style.transform = 'scale(' + scale + ')';
      clone.style.transformOrigin = 'top left';
      page.appendChild(clone);

      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = String(i + 1);

      item.appendChild(page);
      item.appendChild(label);
      box.appendChild(item);
    }
    syncThumbs();
  }

  // ── Zoom ───────────────────────────────────────────────────────────────
  // Zoom is pure CSS: the library renders once at natural size, and we scale
  // .docx-wrapper with a transform inside an explicitly-sized box.

  function fitScale() {
    const stage = refs.stage.current;
    if (!it.current.naturalWidth || !stage) return 1;
    const avail = stage.clientWidth - STAGE_PADDING * 2;
    return Math.min(FIT_MAX, avail / it.current.naturalWidth);
  }

  function applyScale() {
    const stage = refs.stage.current;
    const docBox = refs.docBox.current;
    const wrapperEl = it.current.wrapperEl;
    const naturalWidth = it.current.naturalWidth;
    if (!stateRef.current.docLoaded || !wrapperEl || !naturalWidth || !stage || !docBox) return;

    // Keep the same relative scroll position across the zoom change.
    const maxY = stage.scrollHeight - stage.clientHeight;
    const maxX = stage.scrollWidth - stage.clientWidth;
    const ratioY = maxY > 0 ? stage.scrollTop / maxY : 0;
    const ratioX = maxX > 0 ? stage.scrollLeft / maxX : 0;

    const mode = stateRef.current.scaleMode;
    const scale = mode === 'fit' ? fitScale() : mode;
    setCurrentScale(scale);
    docBox.style.width = Math.ceil(naturalWidth * scale) + 'px';
    docBox.style.height = Math.ceil(it.current.naturalHeight * scale) + 'px';
    // Pin the wrapper to the natural content width so the top-left-origin
    // transform lines up exactly with the zoom box.
    wrapperEl.style.width = naturalWidth + 'px';
    wrapperEl.style.transform = 'scale(' + scale + ')';
    wrapperEl.style.transformOrigin = 'top left';

    const newMaxY = stage.scrollHeight - stage.clientHeight;
    const newMaxX = stage.scrollWidth - stage.clientWidth;
    if (newMaxY > 0) stage.scrollTop = ratioY * newMaxY;
    if (newMaxX > 0) stage.scrollLeft = ratioX * newMaxX;
  }

  function zoomStep(direction: 1 | -1) {
    // currentScale carries sub-pixel fit error (e.g. 0.99998); snap to the
    // nearest grid line within tolerance first, or the buttons look dead.
    let steps = stateRef.current.currentScale / SCALE_STEP;
    const nearest = Math.round(steps);
    if (Math.abs(steps - nearest) < 0.01) steps = nearest;
    const next = direction > 0 ? (Math.floor(steps) + 1) * SCALE_STEP : (Math.ceil(steps) - 1) * SCALE_STEP;
    applyScaleWith(Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(next * 100) / 100)));
  }

  // applyScale reads scaleMode from stateRef; callers that just changed the
  // mode must update the mirror first (setScaleMode alone lands next render).
  function applyScaleWith(mode: 'fit' | number) {
    stateRef.current.scaleMode = mode;
    setScaleMode(mode);
    applyScale();
  }

  function setScale(value: string) {
    setDropdownOpen(false);
    applyScaleWith(value === 'fit' ? 'fit' : parseFloat(value));
  }

  function toggleThumbs() {
    const next = !stateRef.current.thumbsVisible;
    setThumbsVisible(next);
    stateRef.current.thumbsVisible = next;
    // The sidebar eats stage width — re-fit so fit-width stays correct.
    if (stateRef.current.docLoaded && stateRef.current.scaleMode === 'fit') applyScale();
  }

  // ── Page corners ───────────────────────────────────────────────────────
  // Office/WPS-style crop marks: four L-brackets whose joints sit exactly
  // on the text-area corners (the page's padding corners).

  function addPageCorners(section: HTMLElement) {
    const cs = getComputedStyle(section);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padRight = parseFloat(cs.paddingRight) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const padLeft = parseFloat(cs.paddingLeft) || 0;
    const right = section.offsetWidth - padRight; // text-area right edge
    const bottom = section.offsetHeight - padBottom; // text-area bottom edge
    const size = Math.max(4, Math.round(Math.min(padTop, padRight, padBottom, padLeft) * 0.25));

    const boxes = {
      tl: { left: padLeft - size, top: padTop - size },
      tr: { left: right, top: padTop - size },
      bl: { left: padLeft - size, top: bottom },
      br: { left: right, top: bottom },
    };

    for (const name of CORNER_NAMES) {
      const corner = document.createElement('i');
      corner.className = 'page-corner ' + name;
      corner.setAttribute('aria-hidden', 'true');
      corner.style.width = size + 'px';
      corner.style.height = size + 'px';
      corner.style.left = boxes[name].left + 'px';
      corner.style.top = boxes[name].top + 'px';
      section.appendChild(corner);
    }
  }

  // ── Pages ──────────────────────────────────────────────────────────────

  function scrollStageTo(element: HTMLElement) {
    const stage = refs.stage.current;
    if (!stage) return;
    const paddingTop = parseFloat(getComputedStyle(stage).paddingTop) || 0;
    stage.scrollTop =
      stage.scrollTop +
      (element.getBoundingClientRect().top - stage.getBoundingClientRect().top) -
      paddingTop;
  }

  function goToPage(index: number) {
    const sections = it.current.sections;
    if (!stateRef.current.docLoaded || sections.length === 0) return;
    const clamped = Math.max(0, Math.min(index, sections.length - 1));
    it.current.currentPage = clamped;
    setCurrentPage(clamped);
    scrollStageTo(sections[clamped]);
  }

  function jumpToPage(inputValue: string) {
    const target = parseInt(inputValue, 10);
    if (!Number.isNaN(target)) goToPage(target - 1);
  }

  function trackPages() {
    if (it.current.pageObserver) {
      it.current.pageObserver.disconnect();
      it.current.pageObserver = null;
    }
    const stage = refs.stage.current;
    const sections = it.current.sections;
    if (typeof window.IntersectionObserver !== 'function' || sections.length <= 1 || !stage) return;

    const ratios: number[] = [];
    it.current.pageObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).getAttribute('data-page'));
          if (!Number.isNaN(index)) ratios[index] = entry.intersectionRatio;
        }
        let bestIndex = -1;
        let bestRatio = -1;
        for (let j = 0; j < ratios.length; j++) {
          if (ratios[j] > bestRatio) {
            bestRatio = ratios[j];
            bestIndex = j;
          }
        }
        if (bestIndex >= 0 && bestRatio > 0) {
          it.current.currentPage = bestIndex;
          setCurrentPage(bestIndex);
        }
      },
      { root: stage, threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    );
    for (const section of sections) it.current.pageObserver.observe(section);
  }

  // ── Document loading ───────────────────────────────────────────────────

  function resetDocument() {
    if (it.current.pageObserver) {
      it.current.pageObserver.disconnect();
      it.current.pageObserver = null;
    }
    const docBox = refs.docBox.current;
    const thumbs = refs.thumbs.current;
    if (docBox) {
      docBox.innerHTML = '';
      docBox.style.width = '';
      docBox.style.height = '';
    }
    if (thumbs) thumbs.innerHTML = '';
    it.current.thumbPageSynced = -1;
    it.current.wrapperEl = null;
    it.current.sections = [];
    it.current.naturalWidth = 0;
    it.current.naturalHeight = 0;
    it.current.currentPage = 0;
    setCurrentPage(0);
    setPageCount(0);
    setDocLoaded(false);
  }

  async function openBuffer(buffer: ArrayBuffer, label: string) {
    resetDocument();
    setError(null);
    setDropdownOpen(false);
    setLoading(true);

    if (isLegacyBinary(buffer)) {
      setLoading(false);
      const legacyErr = new Error('legacy binary document (.wps/.doc), not OOXML');
      setError({
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail:
          '这是旧版二进制文档格式(.wps / .doc),不是 OOXML(.docx)。' +
          '即使是新版 WPS Office,默认保存的 .wps 仍是二进制格式。' +
          '请用 WPS 或 Word 将其另存为 .docx 后重试。',
      });
      optionsRef.current.onError?.(legacyErr);
      return;
    }

    const renderOptions: Partial<Options> = {
      hideWrapperOnPrint: true,
      paginate: true,
      // 'experimental' only gates tab-stop computation, which 公文版记
      // lines (right-aligned tab stops) depend on.
      experimental: true,
      ...optionsRef.current.renderOptions,
    };

    try {
      const docBox = refs.docBox.current;
      const stage = refs.stage.current;
      if (!docBox || !stage) throw new Error('viewer is not mounted');
      const result = await renderAsync(buffer, docBox, undefined, renderOptions);

      const wrapperEl = (docBox.querySelector('.docx-wrapper') as HTMLElement) || docBox;
      it.current.wrapperEl = wrapperEl;

      const found = wrapperEl.querySelectorAll('section');
      const sections: HTMLElement[] = [];
      for (let i = 0; i < found.length; i++) {
        const section = found[i] as HTMLElement;
        section.setAttribute('data-page', String(i));
        addPageCorners(section);
        sections.push(section);
      }
      it.current.sections = sections;

      // Natural page size, measured before any transform is applied. The
      // wrapper is a full-width block, so its own width is the stage's —
      // the document's real width is the widest fixed-width page section.
      let naturalWidth = 0;
      for (const section of sections) {
        naturalWidth = Math.max(naturalWidth, section.offsetWidth);
      }
      if (!naturalWidth) naturalWidth = wrapperEl.scrollWidth;
      it.current.naturalWidth = naturalWidth;
      it.current.naturalHeight = wrapperEl.offsetHeight;
      it.current.currentPage = 0;

      stateRef.current.docLoaded = true;
      setDocLoaded(true);
      setPageCount(sections.length);
      setCurrentPage(0);
      applyScale();
      buildThumbs();
      trackPages();
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
      optionsRef.current.onRendered?.(result);
    } catch (err) {
      console.error(err);
      resetDocument();
      setError({
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail: errorText(err) + ' —— 请确认这是有效且未加密的 .docx 文件。',
      });
      optionsRef.current.onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  /** Opens a document. `data` may be a Blob, ArrayBuffer or Uint8Array. */
  async function open(data: Blob | ArrayBuffer | Uint8Array | null | undefined, name?: string) {
    if (!data) return;
    const docName =
      name || (typeof File !== 'undefined' && data instanceof File && data.name) || 'document.docx';
    it.current.docName = docName;
    it.current.docBlob = data instanceof Blob ? data : new Blob([data as ArrayBuffer]);

    if (data instanceof Blob) {
      let buffer: ArrayBuffer;
      try {
        buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsArrayBuffer(data);
        });
      } catch (err) {
        setError({ title: '读取文件失败', detail: '浏览器无法读取「' + docName + '」,请重试。' });
        optionsRef.current.onError?.(err);
        return;
      }
      return openBuffer(buffer, docName);
    }
    return openBuffer(data as ArrayBuffer, docName);
  }

  /** Opens a document from a URL — plain GET by default; pass customRequest to customize the request (auth headers, tokens, …). */
  async function openUrl(url: string, customRequest?: DocxCustomRequest, name?: string) {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      let data: Blob | ArrayBuffer | Uint8Array | null;
      if (customRequest) {
        data = await customRequest(url);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
        data = await response.blob();
      }
      if (!data) throw new Error('文档数据为空');
      return await open(data, name || nameFromUrl(url));
    } catch (err) {
      console.error(err);
      setError({
        title: '加载文档失败',
        detail: errorText(err) + ' —— 请确认地址可访问(如需鉴权请使用 customRequest)。',
      });
      optionsRef.current.onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const docBlob = it.current.docBlob;
    if (!docBlob) return;
    const objectUrl = URL.createObjectURL(docBlob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = it.current.docName || 'document.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }

  // ── Global listeners (registered once, read fresh state via stateRef) ──

  useEffect(() => {
    function onWindowResize() {
      if (stateRef.current.docLoaded && stateRef.current.scaleMode === 'fit') applyScale();
    }
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('.docx-viewer .scale-select')) {
        setDropdownOpen(false);
      }
    }
    function onDocumentKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDropdownOpen(false);

      const tag = event.target && (event.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Only steal navigation keys when this viewer contains the focus.
      if (!refs.stage.current || !refs.stage.current.contains(event.target as Node)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goToPage(stateRef.current.currentPage - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        goToPage(stateRef.current.currentPage + 1);
      } else if (event.key === 'Home') {
        goToPage(0);
      } else if (event.key === 'End') {
        goToPage(it.current.sections.length - 1);
      }
    }

    window.addEventListener('resize', onWindowResize);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    return () => {
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
      if (it.current.pageObserver) {
        it.current.pageObserver.disconnect();
        it.current.pageObserver = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // currentPage highlight in the sidebar (the Vue port uses a watcher).
  useEffect(() => {
    syncThumbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, thumbsShown]);

  return {
    // element refs (bound by the components)
    ...refs,
    // state
    loading,
    error,
    docLoaded,
    currentPage,
    pageCount,
    currentScale,
    scaleMode,
    thumbsVisible,
    dropdownOpen,
    setDropdownOpen,
    pagerShown,
    thumbsShown,
    canPrev,
    canNext,
    canZoomOut,
    canZoomIn,
    scaleLabel,
    // actions
    open,
    openUrl,
    goToPage,
    jumpToPage,
    zoomStep,
    setScale,
    toggleThumbs,
    download,
  };
}

export type DocxViewerApi = ReturnType<typeof useDocViewer>;
