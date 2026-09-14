// React DOCX viewer component — WPS-style toolbar, pager, zoom, thumbnails and
// page corners. The whole chrome lives in this one file, mirroring
// packages/vue-docx-preview/src/DocxViewer.vue: reactive state and the DOM work
// that can't be expressed declaratively are in ./hooks/useDocViewer, the icons
// in ./components/icons. The document is fetched from the `url` prop (optionally
// via `customRequest`, e.g. for authenticated endpoints) and re-renders when it
// changes; initialScale/showThumbs/renderOptions describe the initial mount
// (like viewer.html's URL params).
import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Options } from '@apollo-design/docx-preview'
import { useDocViewer } from './hooks/useDocViewer'
import type { DocxCustomRequest } from './hooks/useDocViewer'
import { IconThumbs } from './components/icons/IconThumbs'
import { IconPrevPage } from './components/icons/IconPrevPage'
import { IconNextPage } from './components/icons/IconNextPage'
import { IconZoomOut } from './components/icons/IconZoomOut'
import { IconZoomIn } from './components/icons/IconZoomIn'
import { IconChevronDown } from './components/icons/IconChevronDown'
import { IconOpenFile } from './components/icons/IconOpenFile'
import { IconDownload } from './components/icons/IconDownload'
import './styles/viewer.css'

const SCALES = ['fit', '0.5', '0.75', '1', '1.25', '1.5', '2']

export interface DocxViewerProps {
  /** 文档地址,默认 GET 读取;变化即重新加载。为空(null/空串)时显示空态 */
  url?: string | null
  /** 自定义请求(可附加鉴权头等),返回文档数据;缺省用 fetch GET */
  customRequest?: DocxCustomRequest
  /** document name for the download button; defaults to the URL's last path segment */
  name?: string
  /** 'fit' | number (0.75, 75, …) — initial zoom; mount-time only */
  initialScale?: 'fit' | number
  /** initial thumbnail sidebar visibility; mount-time only */
  showThumbs?: boolean
  /** library render options, merged over { paginate, experimental } */
  renderOptions?: Partial<Options>
  /** 无文档时的占位内容(Vue 版 `#empty` 插槽的对应物) */
  empty?: ReactNode
  className?: string
  style?: CSSProperties
  onRendered?: (result: unknown) => void
  onError?: (error: unknown) => void
}

export function DocxViewer({
  url = null,
  customRequest,
  name,
  initialScale,
  showThumbs,
  renderOptions,
  empty,
  className,
  style,
  onRendered,
  onError,
}: DocxViewerProps) {
  // ── DOM refs ──
  const stage = useRef<HTMLElement>(null)
  const docBox = useRef<HTMLDivElement>(null)
  const thumbs = useRef<HTMLElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const api = useDocViewer(
    { stage, docBox, thumbs },
    { initialScale, showThumbs, renderOptions, onRendered, onError },
  )

  // customRequest is a function prop — read it through a ref so an inline
  // lambda doesn't retrigger the load on every render.
  const requestRef = useRef(customRequest)
  requestRef.current = customRequest

  const hasUrl = typeof url === 'string' && url.length > 0
  const showEmpty = !hasUrl && !api.loading

  useEffect(() => {
    if (hasUrl && url) api.openUrl(url, requestRef.current, name)
    else api.close()
    // openUrl/close read the latest props through refs, so re-running only when
    // the document identity changes matches the Vue port's `watch([url, name])`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, name])

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files && input.files[0]
    if (file) api.open(file)
    // Reset so picking the same file twice still fires change.
    input.value = ''
  }

  function onJump(event: React.SyntheticEvent<HTMLInputElement>) {
    const input = event.currentTarget
    api.jumpToPage(input.value)
    input.blur()
  }

  function onThumbClick(event: React.MouseEvent) {
    const item = (event.target as HTMLElement).closest('.thumb')
    if (item) api.goToPage(Number(item.getAttribute('data-page')))
  }

  return (
    <div className={className ? `docx-viewer ${className}` : 'docx-viewer'} style={style}>
      <header className="toolbar" hidden={!api.docLoaded}>
        <div className="toolbar-left">
          <button
            className={api.thumbsShown ? 'tbtn active' : 'tbtn'}
            type="button"
            title="缩略图"
            disabled={!api.docLoaded || api.pageCount <= 1}
            onClick={api.toggleThumbs}
          >
            <IconThumbs />
          </button>
          <span className="toolbar-divider"></span>
          <span className="pager" hidden={!api.pagerShown}>
            <button
              className="tbtn"
              type="button"
              title="上一页"
              disabled={!api.canPrev}
              onClick={() => api.goToPage(api.currentPage - 1)}
            >
              <IconPrevPage />
            </button>
            <span className="page-info">
              {/* Uncontrolled + keyed by page: typing is free-form, and a page
                  change remounts the input with the fresh page number. */}
              <input
                key={api.currentPage}
                className="page-input"
                type="number"
                min={1}
                step={1}
                defaultValue={api.pageCount > 0 ? api.currentPage + 1 : ''}
                aria-label="当前页码"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onJump(e)
                }}
                onBlur={onJump}
              />
              <span className="page-total">/ {api.pageCount > 0 ? api.pageCount : '–'}</span>
            </span>
            <button
              className="tbtn"
              type="button"
              title="下一页"
              disabled={!api.canNext}
              onClick={() => api.goToPage(api.currentPage + 1)}
            >
              <IconNextPage />
            </button>
          </span>
        </div>

        <div className="toolbar-center">
          <div className="zoom-group">
            <button
              className="tbtn"
              type="button"
              title="缩小"
              disabled={!api.canZoomOut}
              onClick={() => api.zoomStep(-1)}
            >
              <IconZoomOut />
            </button>
            <div className="scale-select">
              <button
                className="tbtn scale-display"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  api.setDropdownOpen(!api.dropdownOpen)
                }}
              >
                <span>{api.scaleLabel}</span>
                <IconChevronDown />
              </button>
              <div className="dropdown" hidden={!api.dropdownOpen}>
                {SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={
                      (api.scaleMode === 'fit' && s === 'fit') || String(api.scaleMode) === s
                        ? 'selected'
                        : undefined
                    }
                    onClick={() => api.setScale(s)}
                  >
                    {s === 'fit' ? '适应宽度' : Math.round(parseFloat(s) * 100) + '%'}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="tbtn"
              type="button"
              title="放大"
              disabled={!api.canZoomIn}
              onClick={() => api.zoomStep(1)}
            >
              <IconZoomIn />
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            className="tbtn"
            type="button"
            title="打开文档"
            onClick={() => fileInput.current?.click()}
          >
            <IconOpenFile />
          </button>
          <button
            className="tbtn"
            type="button"
            title="下载文档"
            disabled={!api.docLoaded}
            onClick={api.download}
          >
            <IconDownload />
          </button>
          <input ref={fileInput} type="file" accept=".docx" hidden onChange={onFileChange} />
        </div>
      </header>

      <div className="error-banner" hidden={!api.error}>
        <strong>{api.error?.title}</strong>
        <span>{api.error?.detail}</span>
      </div>

      <div className="body">
        <aside
          ref={thumbs}
          className="thumbs"
          hidden={!api.thumbsShown}
          aria-label="页面缩略图"
          onClick={onThumbClick}
        />

        <main ref={stage} className="stage">
          <div className="loading" hidden={!api.loading}>
            <div className="spinner"></div>
            <p>加载中…</p>
          </div>

          {/* The library renders into this box; hidden while there is no URL. */}
          <div ref={docBox} className="document" hidden={!hasUrl} />

          {showEmpty && (
            <div className="empty">
              {empty ?? (
                <div className="empty-default">
                  <p>暂无预览文档</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default DocxViewer
