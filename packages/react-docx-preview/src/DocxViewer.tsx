// React DOCX viewer component — a port of apps/viewer (toolbar, pager,
// zoom, thumbnails, page corners). The document is fetched from the `url`
// prop (optionally via `customRequest`, e.g. for authenticated endpoints)
// and re-renders when it changes; initialScale/showThumbs/renderOptions
// describe the initial mount (like viewer.html's URL params).
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Options } from '@apollo-design/docx-preview';
import { useDocViewer } from './hooks/useDocViewer';
import type { DocxCustomRequest } from './hooks/useDocViewer';
import { DocxViewerContext } from './context';
import { Toolbar } from './components/Toolbar';
import { ErrorBanner } from './components/ErrorBanner';
import { ThumbnailsSidebar } from './components/ThumbnailsSidebar';
import { DocumentStage } from './components/DocumentStage';
import './styles/viewer.css';

export interface DocxViewerProps {
  /** 文档地址,默认 GET 读取;变化即重新加载 */
  url: string;
  /** 自定义请求(可附加鉴权头等),返回文档数据;缺省用 fetch GET */
  customRequest?: DocxCustomRequest;
  /** document name for the download button; defaults to the URL's last path segment */
  name?: string;
  /** 'fit' | number (0.75, 75, …) — initial zoom; mount-time only */
  initialScale?: 'fit' | number;
  /** initial thumbnail sidebar visibility; mount-time only */
  showThumbs?: boolean;
  /** library render options, merged over { paginate, experimental } */
  renderOptions?: Partial<Options>;
  className?: string;
  style?: CSSProperties;
  onRendered?: (result: unknown) => void;
  onError?: (error: unknown) => void;
}

export function DocxViewer({
  url,
  customRequest,
  name,
  initialScale,
  showThumbs,
  renderOptions,
  className,
  style,
  onRendered,
  onError,
}: DocxViewerProps) {
  const stage = useRef<HTMLElement>(null);
  const docBox = useRef<HTMLElement>(null);
  const thumbs = useRef<HTMLElement>(null);

  const api = useDocViewer(
    { stage, docBox, thumbs },
    { initialScale, showThumbs, renderOptions, onRendered, onError },
  );

  // customRequest is a function prop — read it through a ref so an inline
  // lambda doesn't retrigger the load on every render.
  const requestRef = useRef(customRequest);
  requestRef.current = customRequest;

  useEffect(() => {
    if (url) api.openUrl(url, requestRef.current, name);
    // openUrl is stable (reads latest props through refs); re-run only on url.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, name]);

  return (
    <DocxViewerContext.Provider value={api}>
      <div className={className ? `docx-viewer ${className}` : 'docx-viewer'} style={style}>
        <Toolbar />
        <ErrorBanner />
        <div className="body">
          <ThumbnailsSidebar />
          <DocumentStage />
        </div>
      </div>
    </DocxViewerContext.Provider>
  );
}

export default DocxViewer;
