// Hand-written declaration for the SFC: TypeScript can't read .svelte files, so
// `export … from './DocxViewer.svelte'` resolves through this sibling instead.
import type { Component } from 'svelte'
import type { DocxViewerProps } from './types'

declare const DocxViewer: Component<DocxViewerProps>
export default DocxViewer
export type { DocxViewerProps }
