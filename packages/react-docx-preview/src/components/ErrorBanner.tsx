import { useDocxViewer } from '../context';

export function ErrorBanner() {
  const api = useDocxViewer();

  return (
    <div className="error-banner" hidden={!api.error}>
      <strong>{api.error?.title}</strong>
      <span>{api.error?.detail}</span>
    </div>
  );
}
