import { createContext, useContext } from 'react';
import type { DocxViewerApi } from './hooks/useDocViewer';

export const DocxViewerContext = createContext<DocxViewerApi | null>(null);

export function useDocxViewer(): DocxViewerApi {
  const api = useContext(DocxViewerContext);
  if (!api) throw new Error('DocxViewer components must be used inside <DocxViewer>');
  return api;
}
