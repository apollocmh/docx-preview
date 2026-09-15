import type { Options } from '@apollo-design/docx-preview'
import type { DocxCustomRequest } from './composables/useDocViewer.svelte'

export interface DocxViewerProps {
  /** 文档地址,默认 GET 读取;变化即重新加载。为空(null/空串)时显示空态 */
  url?: string | null
  /** 自定义请求(可附加鉴权头等),返回文档数据;缺省用 fetch GET */
  customRequest?: DocxCustomRequest
  /** document name for the download button; defaults to the URL's last path segment */
  name?: string
  /** 'fit' | number (0.75, 75, …) — initial zoom; mount-time only */
  initialScale?: 'fit' | number
  /** initial thumbnail sidebar visibility; mount-time only */
  showThumbs?: boolean
  /** library render options, merged over { paginate, experimental } */
  renderOptions?: Partial<Options>
  /** 无文档时的占位内容(其它 wrapper 的空态插槽/prop 对应物);缺省「暂无预览文档」 */
  empty?: import('svelte').Snippet
  /** 根元素 class(与内置 `docx-viewer` 合并) */
  class?: string
  onRendered?: (result: unknown) => void
  onError?: (error: unknown) => void
}
