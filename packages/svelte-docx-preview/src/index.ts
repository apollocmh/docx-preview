export { default as DocxViewer, default } from './DocxViewer.svelte'
export { useDocViewer } from './composables/useDocViewer.svelte'
export type { DocxViewerProps } from './types'
export type {
  DocxViewerApi,
  DocxViewerOptions,
  DocxViewerRefs,
  DocxCustomRequest,
} from './composables/useDocViewer.svelte'
export { renderAsync, parseAsync, renderDocument, defaultOptions } from '@apollo-design/docx-preview'
