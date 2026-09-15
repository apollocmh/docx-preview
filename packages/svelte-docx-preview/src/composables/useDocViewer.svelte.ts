// Core viewer logic, ported from apps/viewer/viewer.js — the Svelte 5 twin of
// the vue/react wrappers. Reactive values are runes ($state / $derived);
// everything else (library render output, thumbnail clones, page corners, zoom
// transforms) is imperative DOM work against the element refs the host
// component hands over.
//
// Unlike React, rune reads inside plain functions see the live value, so no
// state mirror is needed here.
import { detectOfficeFileKind, decryptDocx, DocxPasswordError, renderAsync } from '@apollo-design/docx-preview'
import type { Options } from '@apollo-design/docx-preview'

// Zoom-button range. Stepping clamps here so a step never strands the
// buttons in a disabled state.
const SCALE_MIN = 0.1
const SCALE_MAX = 4
const SCALE_STEP = 0.25
// Fit-width never upscales: a document reads best at its natural size.
const FIT_MAX = 1
const STAGE_PADDING = 24 // .stage padding on each side, see viewer.css
const THUMB_WIDTH = 96 // matches .thumb-page width in viewer.css
const CORNER_NAMES = ['tl', 'tr', 'bl', 'br'] as const

export interface DocxViewerRefs {
  /** Element getters — the component binds them with `bind:this`. */
  stage: () => HTMLElement | undefined
  docBox: () => HTMLElement | undefined
  thumbs: () => HTMLElement | undefined
}

export interface DocxViewerOptions {
  /** 'fit' (fit-width, never upscales) or a number like 0.75 / 75 */
  initialScale?: 'fit' | number
  /** initial thumbnail sidebar visibility (default true) */
  showThumbs?: boolean
  /** library render options, merged over { hideWrapperOnPrint, paginate, experimental } */
  renderOptions?: Partial<Options>
  onRendered?: (result: unknown) => void
  onError?: (error: unknown) => void
}

/** 自定义文档请求(可附加鉴权头等),返回文档数据 */
export type DocxCustomRequest = (url: string) => Promise<Blob | ArrayBuffer | Uint8Array | null>

function errorText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as Error).message)
  return String(err)
}

// Download-button fallback name: last path segment of the URL.
function nameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, window.location.href).pathname
    const last = pathname.split('/').filter(Boolean).pop()
    return (last && decodeURIComponent(last)) || 'document.docx'
  } catch {
    return 'document.docx'
  }
}

function initialScaleMode(value: 'fit' | number | undefined): 'fit' | number {
  if (typeof value === 'number' && isFinite(value) && value > 0) {
    const n = value > 10 ? value / 100 : value
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n * 100) / 100))
  }
  return 'fit'
}

export function useDocViewer(refs: DocxViewerRefs, options: DocxViewerOptions = {}) {
  // ── UI state ───────────────────────────────────────────────────────────
  let loading = $state(false)
  let error = $state<{ title: string; detail: string } | null>(null)
  let docLoaded = $state(false)
  let currentPage = $state(0)
  let pageCount = $state(0)
  let currentScale = $state(1)
  let scaleMode = $state<'fit' | number>(initialScaleMode(options.initialScale))
  let thumbsVisible = $state(options.showThumbs !== false)
  let dropdownOpen = $state(false)
  // Password prompt for encrypted documents. `null` = no dialog.
  let passwordPrompt = $state<{ fileName: string; wrong: boolean; busy: boolean } | null>(null)

  // ── Mutable internals (live DOM produced by the library) ───────────────
  const it = {
    docName: '',
    // The opened document kept as a Blob so the download button works
    // regardless of the input type (Blob / ArrayBuffer / Uint8Array).
    docBlob: null as Blob | null,
    wrapperEl: null as HTMLElement | null,
    sections: [] as HTMLElement[],
    naturalWidth: 0,
    naturalHeight: 0,
    pageObserver: null as IntersectionObserver | null,
    thumbPageSynced: -1,
    /** Encrypted bytes waiting for the password. */
    pendingEncrypted: null as { buffer: ArrayBuffer; label: string } | null,
  }

  const pagerShown = $derived(pageCount > 1)
  const thumbsShown = $derived(thumbsVisible && pageCount > 1 && docLoaded)
  const canPrev = $derived(docLoaded && currentPage > 0)
  const canNext = $derived(docLoaded && currentPage < pageCount - 1)
  const canZoomOut = $derived(docLoaded && currentScale > SCALE_MIN + 1e-6)
  const canZoomIn = $derived(docLoaded && currentScale < SCALE_MAX - 1e-6)
  const scaleLabel = $derived(
    scaleMode === 'fit' ? '适应宽度' : Math.round((scaleMode as number) * 100) + '%',
  )

  // ── Thumbnails ─────────────────────────────────────────────────────────
  // Deep clones of page sections shrunk with a CSS transform — no re-render.

  function syncThumbs() {
    const box = refs.thumbs()
    if (!box) return
    const items = box.children
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('current', Number(items[i].getAttribute('data-page')) === currentPage)
    }
    if (thumbsShown && it.thumbPageSynced !== currentPage && items[currentPage]) {
      it.thumbPageSynced = currentPage
      ;(items[currentPage] as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }

  function buildThumbs() {
    const box = refs.thumbs()
    if (!box) return
    box.innerHTML = ''
    it.thumbPageSynced = -1
    if (it.sections.length <= 1 || !it.naturalWidth) return

    const scale = (THUMB_WIDTH - 2) / it.naturalWidth // 2px = .thumb-page borders
    for (let i = 0; i < it.sections.length; i++) {
      const item = document.createElement('div')
      item.className = 'thumb'
      item.setAttribute('data-page', String(i))

      const page = document.createElement('div')
      page.className = 'thumb-page'
      page.style.height = Math.ceil(it.sections[i].offsetHeight * scale) + 'px'

      const clone = it.sections[i].cloneNode(true) as HTMLElement
      clone.removeAttribute('data-page')
      clone.style.transform = 'scale(' + scale + ')'
      clone.style.transformOrigin = 'top left'
      page.appendChild(clone)

      const label = document.createElement('div')
      label.className = 'thumb-label'
      label.textContent = String(i + 1)

      item.appendChild(page)
      item.appendChild(label)
      box.appendChild(item)
    }
    syncThumbs()
  }

  // ── Zoom ───────────────────────────────────────────────────────────────
  // Zoom is pure CSS: the library renders once at natural size, and we scale
  // .docx-wrapper with a transform inside an explicitly-sized box.

  function fitScale() {
    const stage = refs.stage()
    if (!it.naturalWidth || !stage) return 1
    const avail = stage.clientWidth - STAGE_PADDING * 2
    return Math.min(FIT_MAX, avail / it.naturalWidth)
  }

  function applyScale() {
    const stage = refs.stage()
    const docBox = refs.docBox()
    const wrapperEl = it.wrapperEl
    const naturalWidth = it.naturalWidth
    if (!docLoaded || !wrapperEl || !naturalWidth || !stage || !docBox) return

    // Keep the same relative scroll position across the zoom change.
    const maxY = stage.scrollHeight - stage.clientHeight
    const maxX = stage.scrollWidth - stage.clientWidth
    const ratioY = maxY > 0 ? stage.scrollTop / maxY : 0
    const ratioX = maxX > 0 ? stage.scrollLeft / maxX : 0

    const scale = scaleMode === 'fit' ? fitScale() : (scaleMode as number)
    currentScale = scale
    docBox.style.width = Math.ceil(naturalWidth * scale) + 'px'
    docBox.style.height = Math.ceil(it.naturalHeight * scale) + 'px'
    // Pin the wrapper to the natural content width so the top-left-origin
    // transform lines up exactly with the zoom box.
    wrapperEl.style.width = naturalWidth + 'px'
    wrapperEl.style.transform = 'scale(' + scale + ')'
    wrapperEl.style.transformOrigin = 'top left'

    const newMaxY = stage.scrollHeight - stage.clientHeight
    const newMaxX = stage.scrollWidth - stage.clientWidth
    if (newMaxY > 0) stage.scrollTop = ratioY * newMaxY
    if (newMaxX > 0) stage.scrollLeft = ratioX * newMaxX
  }

  function zoomStep(direction: 1 | -1) {
    // currentScale carries sub-pixel fit error (e.g. 0.99998); snap to the
    // nearest grid line within tolerance first, or the buttons look dead.
    let steps = currentScale / SCALE_STEP
    const nearest = Math.round(steps)
    if (Math.abs(steps - nearest) < 0.01) steps = nearest
    const next = direction > 0 ? (Math.floor(steps) + 1) * SCALE_STEP : (Math.ceil(steps) - 1) * SCALE_STEP
    scaleMode = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(next * 100) / 100))
    applyScale()
  }

  function setScale(value: string) {
    dropdownOpen = false
    scaleMode = value === 'fit' ? 'fit' : parseFloat(value)
    applyScale()
  }

  function toggleThumbs() {
    thumbsVisible = !thumbsVisible
    // The sidebar eats stage width — re-fit so fit-width stays correct.
    if (docLoaded && scaleMode === 'fit') applyScale()
  }

  // ── Page corners ───────────────────────────────────────────────────────
  // Office/WPS-style crop marks: four L-brackets whose joints sit exactly
  // on the text-area corners (the page's padding corners).

  function addPageCorners(section: HTMLElement) {
    const cs = getComputedStyle(section)
    const padTop = parseFloat(cs.paddingTop) || 0
    const padRight = parseFloat(cs.paddingRight) || 0
    const padBottom = parseFloat(cs.paddingBottom) || 0
    const padLeft = parseFloat(cs.paddingLeft) || 0
    const right = section.offsetWidth - padRight // text-area right edge
    const bottom = section.offsetHeight - padBottom // text-area bottom edge
    const size = Math.max(4, Math.round(Math.min(padTop, padRight, padBottom, padLeft) * 0.25))

    const boxes = {
      tl: { left: padLeft - size, top: padTop - size },
      tr: { left: right, top: padTop - size },
      bl: { left: padLeft - size, top: bottom },
      br: { left: right, top: bottom },
    }

    for (const name of CORNER_NAMES) {
      const corner = document.createElement('i')
      corner.className = 'page-corner ' + name
      corner.setAttribute('aria-hidden', 'true')
      corner.style.width = size + 'px'
      corner.style.height = size + 'px'
      corner.style.left = boxes[name].left + 'px'
      corner.style.top = boxes[name].top + 'px'
      section.appendChild(corner)
    }
  }

  // ── Pages ──────────────────────────────────────────────────────────────

  function scrollStageTo(element: HTMLElement) {
    const stage = refs.stage()
    if (!stage) return
    const paddingTop = parseFloat(getComputedStyle(stage).paddingTop) || 0
    stage.scrollTop =
      stage.scrollTop + (element.getBoundingClientRect().top - stage.getBoundingClientRect().top) - paddingTop
  }

  function goToPage(index: number) {
    if (!docLoaded || it.sections.length === 0) return
    currentPage = Math.max(0, Math.min(index, it.sections.length - 1))
    scrollStageTo(it.sections[currentPage])
  }

  function jumpToPage(inputValue: string) {
    const target = parseInt(inputValue, 10)
    if (!Number.isNaN(target)) goToPage(target - 1)
  }

  function trackPages() {
    if (it.pageObserver) {
      it.pageObserver.disconnect()
      it.pageObserver = null
    }
    const stage = refs.stage()
    if (typeof window.IntersectionObserver !== 'function' || it.sections.length <= 1 || !stage) return

    const ratios: number[] = []
    it.pageObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).getAttribute('data-page'))
          if (!Number.isNaN(index)) ratios[index] = entry.intersectionRatio
        }
        let bestIndex = -1
        let bestRatio = -1
        for (let j = 0; j < ratios.length; j++) {
          if (ratios[j] > bestRatio) {
            bestRatio = ratios[j]
            bestIndex = j
          }
        }
        if (bestIndex >= 0 && bestRatio > 0) currentPage = bestIndex
      },
      { root: stage, threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    )
    for (const section of it.sections) it.pageObserver.observe(section)
  }

  // ── Document loading ───────────────────────────────────────────────────

  function resetDocument() {
    if (it.pageObserver) {
      it.pageObserver.disconnect()
      it.pageObserver = null
    }
    const docBox = refs.docBox()
    const thumbs = refs.thumbs()
    if (docBox) {
      docBox.innerHTML = ''
      docBox.style.width = ''
      docBox.style.height = ''
    }
    if (thumbs) thumbs.innerHTML = ''
    it.thumbPageSynced = -1
    it.wrapperEl = null
    it.sections = []
    it.naturalWidth = 0
    it.naturalHeight = 0
    currentPage = 0
    pageCount = 0
    docLoaded = false
  }

  async function openBuffer(buffer: ArrayBuffer, label: string) {
    resetDocument()
    error = null
    dropdownOpen = false
    loading = true

    const kind = detectOfficeFileKind(buffer)
    if (kind === 'encrypted') {
      // Hand the password question to the component; the bytes stay pending
      // until the user answers (see submitPassword / cancelPassword).
      loading = false
      it.pendingEncrypted = { buffer, label }
      passwordPrompt = { fileName: label, wrong: false, busy: false }
      return
    }
    if (kind === 'legacy-binary') {
      loading = false
      const legacyErr = new Error('legacy binary document (.wps/.doc), not OOXML')
      error = {
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail:
          '这是旧版二进制文档格式(.wps / .doc),不是 OOXML(.docx)。' +
          '即使是新版 WPS Office,默认保存的 .wps 仍是二进制格式。' +
          '请用 WPS 或 Word 将其另存为 .docx 后重试。',
      }
      options.onError?.(legacyErr)
      return
    }

    const renderOptions: Partial<Options> = {
      hideWrapperOnPrint: true,
      paginate: true,
      // 'experimental' only gates tab-stop computation, which 公文版记
      // lines (right-aligned tab stops) depend on.
      experimental: true,
      ...options.renderOptions,
    }

    try {
      const docBox = refs.docBox()
      const stage = refs.stage()
      if (!docBox || !stage) throw new Error('viewer is not mounted')
      const result = await renderAsync(buffer, docBox, undefined, renderOptions)

      const wrapperEl = (docBox.querySelector('.docx-wrapper') as HTMLElement) || docBox
      it.wrapperEl = wrapperEl

      const found = wrapperEl.querySelectorAll('section')
      const sections: HTMLElement[] = []
      for (let i = 0; i < found.length; i++) {
        const section = found[i] as HTMLElement
        section.setAttribute('data-page', String(i))
        addPageCorners(section)
        sections.push(section)
      }
      it.sections = sections

      // Natural page size, measured before any transform is applied. The
      // wrapper is a full-width block, so its own width is the stage's —
      // the document's real width is the widest fixed-width page section.
      let naturalWidth = 0
      for (const section of sections) {
        naturalWidth = Math.max(naturalWidth, section.offsetWidth)
      }
      if (!naturalWidth) naturalWidth = wrapperEl.scrollWidth
      it.naturalWidth = naturalWidth
      it.naturalHeight = wrapperEl.offsetHeight

      docLoaded = true
      pageCount = sections.length
      currentPage = 0
      applyScale()
      buildThumbs()
      trackPages()
      stage.scrollTop = 0
      stage.scrollLeft = 0
      options.onRendered?.(result)
    } catch (err) {
      console.error(err)
      resetDocument()
      error = {
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail: errorText(err) + ' —— 请确认这是有效且未加密的 .docx 文件。',
      }
      options.onError?.(err)
    } finally {
      loading = false
    }
  }

  /** Opens a document. `data` may be a Blob, ArrayBuffer or Uint8Array. */
  async function open(data: Blob | ArrayBuffer | Uint8Array | null | undefined, name?: string) {
    if (!data) return
    const docName =
      name || (typeof File !== 'undefined' && data instanceof File && data.name) || 'document.docx'
    it.docName = docName
    it.docBlob = data instanceof Blob ? data : new Blob([data as ArrayBuffer])

    if (data instanceof Blob) {
      let buffer: ArrayBuffer
      try {
        buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as ArrayBuffer)
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
          reader.readAsArrayBuffer(data)
        })
      } catch (err) {
        error = { title: '读取文件失败', detail: '浏览器无法读取「' + docName + '」,请重试。' }
        options.onError?.(err)
        return
      }
      return openBuffer(buffer, docName)
    }
    return openBuffer(data as ArrayBuffer, docName)
  }

  /** Opens a document from a URL — plain GET by default; pass customRequest to customize the request (auth headers, tokens, …). */
  async function openUrl(url: string, customRequest?: DocxCustomRequest, name?: string) {
    if (!url) return
    loading = true
    error = null
    try {
      let data: Blob | ArrayBuffer | Uint8Array | null
      if (customRequest) {
        data = await customRequest(url)
      } else {
        const response = await fetch(url)
        if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText)
        data = await response.blob()
      }
      if (!data) throw new Error('文档数据为空')
      return await open(data, name || nameFromUrl(url))
    } catch (err) {
      console.error(err)
      error = {
        title: '加载文档失败',
        detail: errorText(err) + ' —— 请确认地址可访问(如需鉴权请使用 customRequest)。',
      }
      options.onError?.(err)
    } finally {
      loading = false
    }
  }

  function download() {
    if (!it.docBlob) return
    const objectUrl = URL.createObjectURL(it.docBlob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = it.docName || 'document.docx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
  }

  /** Clears the viewer back to its empty state (no URL to show). */
  function close() {
    resetDocument()
    error = null
    loading = false
  }

  /** 弹窗提交密码：解密成功后继续渲染；密码错误则留在弹窗里提示。 */
  async function submitPassword(password: string) {
    const pending = it.pendingEncrypted
    if (!pending) return
    const { buffer, label } = pending
    if (passwordPrompt) {
      passwordPrompt.busy = true
      passwordPrompt.wrong = false
    }
    try {
      const decrypted = await decryptDocx(buffer, password)
      it.pendingEncrypted = null
      passwordPrompt = null
      await openBuffer(decrypted, label)
    } catch (err) {
      if (err instanceof DocxPasswordError) {
        if (passwordPrompt) {
          passwordPrompt.busy = false
          passwordPrompt.wrong = true
        }
        return
      }
      // 不支持的加密方式（Office 2007 Standard / 证书加密等）
      it.pendingEncrypted = null
      passwordPrompt = null
      loading = false
      error = {
        title: '无法打开' + (label ? '「' + label + '」' : '文档'),
        detail: errorText(err) + ' —— 该加密方式暂不支持,请在 Word / WPS 里取消密码后另存为 .docx。',
      }
      options.onError?.(err)
    }
  }

  /** 用户放弃输入密码 → 回到空态。 */
  function cancelPassword() {
    it.pendingEncrypted = null
    passwordPrompt = null
    close()
  }

  // ── Global listeners (scoped to the component lifetime) ────────────────
  // The effect body itself reads no reactive state, so it runs once.

  $effect(() => {
    function onWindowResize() {
      if (docLoaded && scaleMode === 'fit') applyScale()
    }
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('.docx-viewer .scale-select')) dropdownOpen = false
    }
    function onDocumentKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') dropdownOpen = false

      const tag = event.target && (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Only steal navigation keys when this viewer contains the focus.
      const stage = refs.stage()
      if (!stage || !stage.contains(event.target as Node)) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        goToPage(currentPage - 1)
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' '
      ) {
        event.preventDefault()
        goToPage(currentPage + 1)
      } else if (event.key === 'Home') {
        goToPage(0)
      } else if (event.key === 'End') {
        goToPage(it.sections.length - 1)
      }
    }

    window.addEventListener('resize', onWindowResize)
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)
    return () => {
      window.removeEventListener('resize', onWindowResize)
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onDocumentKeydown)
      if (it.pageObserver) {
        it.pageObserver.disconnect()
        it.pageObserver = null
      }
    }
  })

  // currentPage highlight in the sidebar.
  $effect(() => {
    currentPage
    thumbsShown
    syncThumbs()
  })

  return {
    // state
    get loading() {
      return loading
    },
    get error() {
      return error
    },
    get docLoaded() {
      return docLoaded
    },
    get currentPage() {
      return currentPage
    },
    set currentPage(value: number) {
      currentPage = value
    },
    get pageCount() {
      return pageCount
    },
    get currentScale() {
      return currentScale
    },
    get scaleMode() {
      return scaleMode
    },
    get thumbsVisible() {
      return thumbsVisible
    },
    get dropdownOpen() {
      return dropdownOpen
    },
    get passwordPrompt() {
      return passwordPrompt
    },
    get pagerShown() {
      return pagerShown
    },
    get thumbsShown() {
      return thumbsShown
    },
    get canPrev() {
      return canPrev
    },
    get canNext() {
      return canNext
    },
    get canZoomOut() {
      return canZoomOut
    },
    get canZoomIn() {
      return canZoomIn
    },
    get scaleLabel() {
      return scaleLabel
    },
    // actions
    open,
    openUrl,
    goToPage,
    jumpToPage,
    zoomStep,
    setScale,
    toggleThumbs,
    download,
    close,
    submitPassword,
    cancelPassword,
    toggleDropdown(value?: boolean) {
      dropdownOpen = value === undefined ? !dropdownOpen : value
    },
  }
}

export type DocxViewerApi = ReturnType<typeof useDocViewer>
