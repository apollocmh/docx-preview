# 查看器组件

三版查看器共享同一套实现：WPS 风格工具栏、翻页器、缩放（适应宽度/百分比）、下载、缩略图侧栏、Office 式页角裁切标记，均默认启用重排分页。

## 在线 Demo

- [Browser 原生 Demo](/demos/browser/)

Demo 默认加载站点内置的 `demo.docx`，也可以通过文件选择器预览本地文档（纯浏览器解析，不上传服务器）。

## 组件 Props / 事件

React 与 Vue 组件接口一致：

| Prop | 类型 | 说明 |
|---|---|---|
| `data` | `Blob \| ArrayBuffer \| Uint8Array` | 文档数据，变化即重渲染 |
| `name` | `string` | 下载文件名 |
| `initialScale` | `'fit' \| number` | 初始缩放：适应宽度或百分比 |
| `showThumbs` | `boolean` | 初始是否显示缩略图侧栏 |
| `renderOptions` | `Partial<Options>` | 透传给核心库的[渲染选项](/docs/api)（如 `fonts`） |

事件：`onRendered` / `onError`（Vue 写法 `@rendered` / `@error`）。

## 原生查看器（独立部署）

从 [GitHub Releases](https://github.com/apollocmh/docx-preview/releases) 下载 `docx-preview-viewer-{version}.zip`，解压后部署到任意静态服务器——不依赖 npm、不需要构建工具、无第三方 CDN，通过 iframe 或浏览器直接使用：

```html
<iframe src="/viewer.html?file=https://example.com/document.docx"></iframe>
<!-- 可选初始缩放: 适应宽度(默认) / 自然尺寸百分比 -->
<iframe src="/viewer.html?file=...&scale=fit | 75 | 0.75"></iframe>
<!-- 可选初始缩略图侧栏: 显示(默认) / 隐藏 -->
<iframe src="/viewer.html?file=...&thumbs=1 | 0"></iframe>
<!-- 可选显式文档名(下载文件名 + 标题),用于媒体库等不透明地址 -->
<iframe src="/viewer.html?file=...&filename=report.docx"></iframe>
```

::: warning CORS 注意
预览器在浏览器内通过 `fetch` 加载 DOCX URL，文件服务器必须允许跨域请求（`Access-Control-Allow-Origin`），或把预览器与文件放在同一来源下。
:::

旧式二进制文档（老 `.doc`、`.wps`）会被预先识别并给出"另存为 .docx"的明确提示；只有 OOXML 包可以渲染。
