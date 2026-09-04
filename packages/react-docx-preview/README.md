# @apollo-design/react-docx-preview

React DOCX 查看器组件——WPS 风格工具栏、翻页器、缩放（适应宽度/百分比）、下载、缩略图侧栏、页角裁切标记，基于 [`@apollo-design/docx-preview`](https://www.npmjs.com/package/@apollo-design/docx-preview)（将 DOCX 渲染为语义化 HTML，含重排分页引擎）。

> 本项目基于 [docxjs](https://github.com/VolodymyrBaydalka/docxjs)（Volodymyr Baydalka，Apache-2.0）深度改造。

## 安装

```bash
pnpm add @apollo-design/react-docx-preview
# 或 npm i / yarn add
```

peer 依赖：`react >= 17`。

## 使用

```jsx
import { DocxViewer } from '@apollo-design/react-docx-preview';
import '@apollo-design/react-docx-preview/style.css';

function App() {
  return (
    <DocxViewer
      url="/files/报告.docx"      // 文档地址,默认 GET 读取,变化即重新加载
      name="报告.docx"            // 下载文件名(缺省取 url 末段)
      style={{ height: '100%' }}  // 组件填满容器,需父级给定高度
      onRendered={() => console.log('rendered')}
      onError={console.error}
    />
  );
}
```

组件高度由外部容器决定（内部 `height: 100%`），请为父元素设置高度。

需要鉴权（token、自定义请求头等）时用 `customRequest` 接管请求：

```jsx
<DocxViewer
  url="/api/files/123"
  customRequest={async (url) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }}
/>
```

## Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `url` | `string` | — | 文档地址，默认 GET 读取；变化即重新加载 |
| `customRequest` | `(url) => Promise<Blob \| ArrayBuffer \| Uint8Array \| null>` | — | 自定义请求（鉴权头等）；缺省用 `fetch` GET |
| `name` | `string` | url 末段 | 下载按钮使用的文件名 |
| `initialScale` | `'fit' \| number` | `'fit'` | 初始缩放：适应宽度或百分比（`0.75` / `75` 均可）；仅挂载时生效 |
| `showThumbs` | `boolean` | `true` | 初始是否显示缩略图侧栏；仅挂载时生效 |
| `renderOptions` | `Partial<Options>` | — | 透传给核心库的渲染选项，合并于 `{ paginate: true, experimental: true }` 之上 |
| `className` / `style` | — | — | 根元素 class / 内联样式 |
| `onRendered` | `(result) => void` | — | 渲染完成回调 |
| `onError` | `(error) => void` | — | 渲染失败回调 |

## 外部字体

通过 `renderOptions.fonts` 注入 webfont。字体族名必须与文档内部引用一致（中文文档常直接引用中文族名，如 `宋体`），别名需列为单独条目：

```jsx
<DocxViewer
  url="/files/报告.docx"
  renderOptions={{
    fonts: [
      { name: 'SimSun', src: 'url(/fonts/simsun.woff2) format("woff2")' },
      { name: '宋体', src: 'url(/fonts/simsun.woff2) format("woff2")' },
    ],
  }}
/>
```

## 在线 Demo

[React Viewer Demo](https://apollocmh.github.io/docx-preview/demos/react/) · [文档站](https://apollocmh.github.io/docx-preview/)

## License

Apache-2.0 · 基于 docxjs（见仓库 NOTICE）
