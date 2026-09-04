import { useDocxViewer } from '../context';

export function DocumentStage() {
  const api = useDocxViewer();

  return (
    <main ref={api.stage as React.RefObject<HTMLElement>} className="stage">
      <div className="loading" hidden={!api.loading}>
        <div className="spinner"></div>
        <p>加载中…</p>
      </div>
      <div ref={api.docBox as React.RefObject<HTMLDivElement>} className="document"></div>
    </main>
  );
}
