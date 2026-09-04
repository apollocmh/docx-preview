// Core viewer logic, ported from apps/viewer/viewer.js. All DOM mutations
// that can't be expressed as data (library render output, thumbnail clones,
// page corners, zoom transforms) happen here against element refs supplied
// by the host component; everything user-facing is reactive state the
// components bind to.
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';
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
  stage: Ref<HTMLElement | undefined>;
  docBox: Ref<HTMLElement | undefined>;
  thumbs: Ref<HTMLElement | undefined>;
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

export function useDocViewer(refs: DocxViewerRefs, options: DocxViewerOptions = {}) {
  // ── Reactive state (bound by the components) ─────────────────────────
  const loading = ref(false);
  const error = ref<{ title: string; detail: string } | null>(null);
  const docLoaded = ref(false);
  const currentPage = ref(0);
  const pageCount = ref(0);
  const currentScale = ref(1);
  const scaleMode = ref<'fit' | number>('fit');
  if (typeof options.initialScale === 'number' && isFinite(options.initialScale) && options.initialScale > 0) {
    const n = options.initialScale > 10 ? options.initialScale / 100 : options.initialScale;
    scaleMode.value = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n * 100) / 100));
  }
  // Sidebar visibility is a user preference; a single-page document never
  // shows it regardless of this flag.
  const thumbsVisible = ref(options.showThumbs !== false);
  const dropdownOpen = ref(false);

  const pagerShown = computed(() => pageCount.value > 1);
  const thumbsShown = computed(() => thumbsVisible.value && pageCount.value > 1 && docLoaded.value);
  const canPrev = computed(() => docLoaded.value && currentPage.value > 0);
  const canNext = computed(() => docLoaded.value && currentPage.value < pageCount.value - 1);
  const canZoomOut = computed(() => docLoaded.value && currentScale.value > SCALE_MIN + 1e-6);
  const canZoomIn = computed(() => docLoaded.value && currentScale.value < SCALE_MAX - 1e-6);
  const scaleLabel = computed(() =>
    scaleMode.value === 'fit' ? '适应宽度' : Math.round(scaleMode.value * 100) + '%',
  );

  // ── Non-reactive internals (live DOM produced by the library) ────────
  let docName = '';
  // The opened document kept as a Blob so the download button works
  // regardless of the input type (Blob / ArrayBuffer / Uint8Array).
  let docBlob: Blob | null = null;
  let wrapperEl: HTMLElement | null = null;
  let sections: HTMLElement[] = [];
  let naturalWidth = 0; // px at scale 1
  let naturalHeight = 0;
  let pageObserver: IntersectionObserver | null = null;
  let thumbPageSynced = -1; // last page scrolled into view in the sidebar

  // ── Thumbnails ─────────────────────────────────────────────────────────
  // Deep clones of page sections shrunk with a CSS transform — no re-render.
  // Clones live outside .docx-wrapper, so the stylesheet suppresses their
  // list markers (CSS counters would show wrong numbers otherwise).

  function buildThumbs() {
    const box = refs.thumbs.value;
    if (!box) return;
    box.innerHTML = '';
    thumbPageSynced = -1;
    if (sections.length <= 1 || !naturalWidth) return;

    const scale = (THUMB_WIDTH - 2) / naturalWidth; // 2px = .thumb-page borders
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

  function syncThumbs() {
    const box = refs.thumbs.value;
    if (!box) return;
    const items = box.children;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('current', Number(items[i].getAttribute('data-page')) === currentPage.value);
    }
    if (thumbsShown.value && thumbPageSynced !== currentPage.value && items[currentPage.value]) {
      thumbPageSynced = currentPage.value;
      (items[currentPage.value] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Zoom ───────────────────────────────────────────────────────────────
  // Zoom is pure CSS: the library renders once at natural size, and we scale
  // .docx-wrapper with a transform inside an explicitly-sized box.

  function fitScale() {
    const stage = refs.stage.value;
    if (!naturalWidth || !stage) return 1;
    const avail = stage.clientWidth - STAGE_PADDING * 2;
    return Math.min(FIT_MAX, avail / naturalWidth);
  }

  function applyScale() {
    const stage = refs.stage.value;
    const docBox = refs.docBox.value;
    if (!docLoaded.value || !wrapperEl || !naturalWidth || !stage || !docBox) return;

    // Keep the same relative scroll position across the zoom change.
    const maxY = stage.scrollHeight - stage.clientHeight;
    const maxX = stage.scrollWidth - stage.clientWidth;
    const ratioY = maxY > 0 ? stage.scrollTop / maxY : 0;
    const ratioX = maxX > 0 ? stage.scrollLeft / maxX : 0;

    currentScale.value = scaleMode.value === 'fit' ? fitScale() : scaleMode.value;
    docBox.style.width = Math.ceil(naturalWidth * currentScale.value) + 'px';
    docBox.style.height = Math.ceil(naturalHeight * currentScale.value) + 'px';
    // Pin the wrapper to the natural content width so the top-left-origin
    // transform lines up exactly with the zoom box.
    wrapperEl.style.width = naturalWidth + 'px';
    wrapperEl.style.transform = 'scale(' + currentScale.value + ')';
    wrapperEl.style.transformOrigin = 'top left';

    const newMaxY = stage.scrollHeight - stage.clientHeight;
    const newMaxX = stage.scrollWidth - stage.clientWidth;
    if (newMaxY > 0) stage.scrollTop = ratioY * newMaxY;
    if (newMaxX > 0) stage.scrollLeft = ratioX * newMaxX;
  }

  function zoomStep(direction: 1 | -1) {
    // currentScale carries sub-pixel fit error (e.g. 0.99998); snap to the
    // nearest grid line within tolerance first, or the buttons look dead.
    let steps = currentScale.value / SCALE_STEP;
    const nearest = Math.round(steps);
    if (Math.abs(steps - nearest) < 0.01) steps = nearest;
    const next = direction > 0 ? (Math.floor(steps) + 1) * SCALE_STEP : (Math.ceil(steps) - 1) * SCALE_STEP;
    scaleMode.value = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(next * 100) / 100));
    applyScale();
  }

  function setScaleMode(value: string) {
    scaleMode.value = value === 'fit' ? 'fit' : parseFloat(value);
    dropdownOpen.value = false;
    applyScale();
  }

  function toggleThumbs() {
    thumbsVisible.value = !thumbsVisible.value;
    // The sidebar eats stage width — re-fit so fit-width stays correct.
    if (docLoaded.value && scaleMode.value === 'fit') applyScale();
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
    const stage = refs.stage.value;
    if (!stage) return;
    const paddingTop = parseFloat(getComputedStyle(stage).paddingTop) || 0;
    stage.scrollTop =
      stage.scrollTop +
      (element.getBoundingClientRect().top - stage.getBoundingClientRect().top) -
      paddingTop;
  }

  function goToPage(index: number) {
    if (!docLoaded.value || sections.length === 0) return;
    currentPage.value = Math.max(0, Math.min(index, sections.length - 1));
    scrollStageTo(sections[currentPage.value]);
  }

  function jumpToPage(inputValue: string) {
    const target = parseInt(inputValue, 10);
    if (!Number.isNaN(target)) goToPage(target - 1);
  }

  function trackPages() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    const stage = refs.stage.value;
    if (typeof window.IntersectionObserver !== 'function' || sections.length <= 1 || !stage) return;

    const ratios: number[] = [];
    pageObserver = new IntersectionObserver(
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
        if (bestIndex >= 0 && bestRatio > 0) currentPage.value = bestIndex;
      },
      { root: stage, threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    );
    for (const section of sections) pageObserver.observe(section);
  }

  // ── Document loading ───────────────────────────────────────────────────

  function resetDocument() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    const docBox = refs.docBox.value;
    const thumbs = refs.thumbs.value;
    if (docBox) {
      docBox.innerHTML = '';
      docBox.style.width = '';
      docBox.style.height = '';
    }
    if (thumbs) thumbs.innerHTML = '';
    thumbPageSynced = -1;
    wrapperEl = null;
    sections = [];
    naturalWidth = 0;
    naturalHeight = 0;
    currentPage.value = 0;
    pageCount.value = 0;
    docLoaded.value = false;
  }

  async function openBuffer(buffer: ArrayBuffer, label: string) {
    resetDocument();
    error.value = null;
    dropdownOpen.value = false;
    loading.value = true;

    if (isLegacyBinary(buffer)) {
      loading.value = false;
      const legacyErr = new Error('legacy binary document (.wps/.doc), not OOXML');
      error.value = {
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail:
          '这是旧版二进制文档格式(.wps / .doc),不是 OOXML(.docx)。' +
          '即使是新版 WPS Office,默认保存的 .wps 仍是二进制格式。' +
          '请用 WPS 或 Word 将其另存为 .docx 后重试。',
      };
      options.onError?.(legacyErr);
      return;
    }

    const renderOptions: Partial<Options> = {
      hideWrapperOnPrint: true,
      paginate: true,
      // 'experimental' only gates tab-stop computation, which 公文版记
      // lines (right-aligned tab stops) depend on.
      experimental: true,
      ...options.renderOptions,
    };

    try {
      const docBox = refs.docBox.value;
      const stage = refs.stage.value;
      if (!docBox || !stage) throw new Error('viewer is not mounted');
      const result = await renderAsync(buffer, docBox, undefined, renderOptions);

      wrapperEl = (docBox.querySelector('.docx-wrapper') as HTMLElement) || docBox;

      const found = wrapperEl.querySelectorAll('section');
      sections = [];
      for (let i = 0; i < found.length; i++) {
        const section = found[i] as HTMLElement;
        section.setAttribute('data-page', String(i));
        addPageCorners(section);
        sections.push(section);
      }

      // Natural page size, measured before any transform is applied. The
      // wrapper is a full-width block, so its own width is the stage's —
      // the document's real width is the widest fixed-width page section.
      naturalWidth = 0;
      for (const section of sections) {
        naturalWidth = Math.max(naturalWidth, section.offsetWidth);
      }
      if (!naturalWidth) naturalWidth = wrapperEl.scrollWidth;
      naturalHeight = wrapperEl.offsetHeight;

      docLoaded.value = true;
      pageCount.value = sections.length;
      currentPage.value = 0;
      applyScale();
      buildThumbs();
      trackPages();
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
      options.onRendered?.(result);
    } catch (err) {
      console.error(err);
      resetDocument();
      error.value = {
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail: errorText(err) + ' —— 请确认这是有效且未加密的 .docx 文件。',
      };
      options.onError?.(err);
    } finally {
      loading.value = false;
    }
  }

  /** Opens a document. `data` may be a Blob, ArrayBuffer or Uint8Array. */
  async function open(data: Blob | ArrayBuffer | Uint8Array | null | undefined, name?: string) {
    if (!data) return;
    docName = name || (typeof File !== 'undefined' && data instanceof File && data.name) || 'document.docx';
    docBlob = data instanceof Blob ? data : new Blob([data as ArrayBuffer]);

    if (data instanceof Blob) {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsArrayBuffer(data);
      }).catch((err) => {
        error.value = { title: '读取文件失败', detail: '浏览器无法读取「' + docName + '」,请重试。' };
        options.onError?.(err);
        return null;
      });
      if (!buffer) return;
      return openBuffer(buffer, docName);
    }
    return openBuffer(data as ArrayBuffer, docName);
  }

  function download() {
    if (!docBlob) return;
    const objectUrl = URL.createObjectURL(docBlob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = docName || 'document.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }

  // ── Global listeners / watchers (scoped to the component lifetime) ────

  function onWindowResize() {
    if (docLoaded.value && scaleMode.value === 'fit') applyScale();
  }
  function onDocumentClick(event: MouseEvent) {
    if (dropdownOpen.value && !(event.target as HTMLElement).closest('.scale-select')) {
      dropdownOpen.value = false;
    }
  }
  function onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') dropdownOpen.value = false;

    const tag = event.target && (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Only steal navigation keys when this viewer contains the focus.
    if (!refs.stage.value || !refs.stage.value.contains(event.target as Node)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      goToPage(currentPage.value - 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      goToPage(currentPage.value + 1);
    } else if (event.key === 'Home') {
      goToPage(0);
    } else if (event.key === 'End') {
      goToPage(sections.length - 1);
    }
  }

  window.addEventListener('resize', onWindowResize);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);

  const unwatchPage = watch(currentPage, syncThumbs);

  function destroy() {
    window.removeEventListener('resize', onWindowResize);
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown);
    unwatchPage();
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
  }

  // Auto-destroy with the owning component's effect scope.
  if (getCurrentScope()) onScopeDispose(destroy);

  return {
    // element refs (bound by the host components)
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
    pagerShown,
    thumbsShown,
    canPrev,
    canNext,
    canZoomOut,
    canZoomIn,
    scaleLabel,
    // actions
    open,
    goToPage,
    jumpToPage,
    zoomStep,
    setScaleMode,
    toggleThumbs,
    download,
    destroy,
  };
}

export type DocxViewerApi = ReturnType<typeof useDocViewer>;
