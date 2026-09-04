import { useRef } from 'react';
import { useDocxViewer } from '../context';
import { IconThumbs } from './icons/IconThumbs';
import { IconPrevPage } from './icons/IconPrevPage';
import { IconNextPage } from './icons/IconNextPage';
import { IconZoomOut } from './icons/IconZoomOut';
import { IconZoomIn } from './icons/IconZoomIn';
import { IconChevronDown } from './icons/IconChevronDown';
import { IconOpenFile } from './icons/IconOpenFile';
import { IconDownload } from './icons/IconDownload';

const SCALES = ['fit', '0.5', '0.75', '1', '1.25', '1.5', '2'];

export function Toolbar() {
  const api = useDocxViewer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onJump(event: React.SyntheticEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    api.jumpToPage(input.value);
    input.blur();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files && input.files[0];
    if (file) api.open(file);
    // Reset so picking the same file twice still fires change.
    input.value = '';
  }

  return (
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
                if (e.key === 'Enter') onJump(e);
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
          <button className="tbtn" type="button" title="缩小" disabled={!api.canZoomOut} onClick={() => api.zoomStep(-1)}>
            <IconZoomOut />
          </button>
          <div className="scale-select">
            <button
              className="tbtn scale-display"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                api.setDropdownOpen(!api.dropdownOpen);
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
                    (api.scaleMode === 'fit' && s === 'fit') || String(api.scaleMode) === s ? 'selected' : undefined
                  }
                  onClick={() => api.setScale(s)}
                >
                  {s === 'fit' ? '适应宽度' : Math.round(parseFloat(s) * 100) + '%'}
                </button>
              ))}
            </div>
          </div>
          <button className="tbtn" type="button" title="放大" disabled={!api.canZoomIn} onClick={() => api.zoomStep(1)}>
            <IconZoomIn />
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <button className="tbtn" type="button" title="打开文档" onClick={() => fileInputRef.current?.click()}>
          <IconOpenFile />
        </button>
        <button className="tbtn" type="button" title="下载文档" disabled={!api.docLoaded} onClick={api.download}>
          <IconDownload />
        </button>
        <input ref={fileInputRef} type="file" accept=".docx" hidden onChange={onFileChange} />
      </div>
    </header>
  );
}
