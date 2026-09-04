import { useDocxViewer } from '../context';

export function ThumbnailsSidebar() {
  const api = useDocxViewer();

  function onClick(event: React.MouseEvent) {
    const item = (event.target as HTMLElement).closest('.thumb');
    if (item) api.goToPage(Number(item.getAttribute('data-page')));
  }

  return (
    <aside
      ref={api.thumbs as React.RefObject<HTMLElement>}
      className="thumbs"
      hidden={!api.thumbsShown}
      aria-label="页面缩略图"
      onClick={onClick}
    />
  );
}
