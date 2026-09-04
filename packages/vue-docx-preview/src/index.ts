import DocxViewer from './DocxViewer.vue';

export { DocxViewer, DocxViewer as DocxPreview };
export default DocxViewer;
export { renderAsync, parseAsync, renderDocument, defaultOptions } from '@apollo-design/docx-preview';
export type { DocxViewerApi, DocxViewerOptions, DocxViewerRefs } from './composables/useDocViewer';
