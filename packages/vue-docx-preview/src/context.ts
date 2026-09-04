import type { InjectionKey } from 'vue';
import type { DocxViewerApi } from './composables/useDocViewer';

export const DOCX_VIEWER_KEY: InjectionKey<DocxViewerApi> = Symbol('docx-viewer');
