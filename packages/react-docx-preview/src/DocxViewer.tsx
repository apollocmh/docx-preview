// React DOCX viewer component — a port of apps/viewer (toolbar, pager,
// zoom, thumbnails, page corners). The document is fed via the `data` prop
// and re-renders when it changes; initialScale/showThumbs/renderOptions
// describe the initial mount (like viewer.html's URL params).
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Options } from '@apollo-design/docx-preview';
import { useDocViewer } from './hooks/useDocViewer';
import { DocxViewerContext } from './context';
import { Toolbar } from './components/Toolbar';
import { ErrorBanner } from './components/ErrorBanner';
import { ThumbnailsSidebar } from './components/ThumbnailsSidebar';
import { DocumentStage } from './components/DocumentStage';
import './styles/viewer.css';

export interface DocxViewerProps {
  /** document data — Blob / ArrayBuffer / Uint8Array; re-renders on change */
  data?: Blob | ArrayBuffer | Uint8Array | null;
  /** document name for the download button */
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
  data,
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

  useEffect(() => {
    if (data) api.open(data, name);
    // open is stable (reads latest props through refs); re-run only on data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, name]);

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
