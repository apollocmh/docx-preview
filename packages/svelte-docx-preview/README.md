# @apollo-design/svelte-docx-preview

Svelte 5 DOCX 查看器组件——WPS 风格工具栏、翻页器、缩放（适应宽度/百分比）、下载、缩略图侧栏、页角裁切标记、加密文档密码弹窗，基于 [`@apollo-design/docx-preview`](https://www.npmjs.com/package/@apollo-design/docx-preview)（将 DOCX 渲染为语义化 HTML，含重排分页引擎）。

> 本项目基于 [docxjs](https://github.com/VolodymyrBaydalka/docxjs)（Volodymyr Baydalka，Apache-2.0）深度改造。

## 安装

```bash
pnpm add @apollo-design/svelte-docx-preview
# 或 npm i / yarn add
```

peer 依赖：`svelte >= 5`（组件使用 runes，不支持 Svelte 4）。

## 使用

```svelte
<script lang="ts">
  import { DocxViewer } from '@apollo-design/svelte-docx-preview'
  import '@apollo-design/svelte-docx-preview/style.css'
</script>

<!-- 组件高度由外部容器决定（内部 height: 100%），请为父元素设置高度 -->
<DocxViewer url="/files/报告.docx" class="h-full" onRendered={() => console.log('rendered')} />
```

需要鉴权（token、自定义请求头等）时用 `customRequest` 接管请求：

```svelte
<script lang="ts">
  const customRequest = async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.blob()
  }
</script>

<DocxViewer url="/api/files/123" {customRequest} />
```

## Props

| Prop | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `url` | `string \| null` | `null` | 文档地址，默认 GET 读取；变化即重新加载。为空时显示空态 |
| `customRequest` | `(url) => Promise<Blob \| ArrayBuffer \| Uint8Array \| null>` | — | 自定义请求（鉴权头等）；缺省用 `fetch` GET |
| `name` | `string` | url 末段 | 下载按钮使用的文件名 |
| `initialScale` | `'fit' \| number` | `'fit'` | 初始缩放：适应宽度或百分比（`0.75` / `75` 均可）；仅挂载时生效 |
| `showThumbs` | `boolean` | `true` | 初始是否显示缩略图侧栏；仅挂载时生效 |
| `renderOptions` | `Partial<Options>` | — | 透传给核心库的渲染选项，合并于 `{ paginate: true, experimental: true }` 之上 |
| `empty` | `Snippet` | `暂无预览文档` | 无文档（`url` 为空且未加载）时的占位内容 |
| `class` | `string` | — | 追加到根元素的 class |
| `onRendered` / `onError` | `(result) => void` / `(error) => void` | — | 渲染完成 / 渲染失败回调 |

## 空态

`url` 为空（`null` / 空串）且没有正在加载时，组件渲染 `empty` 片段：

```svelte
<DocxViewer url={fileUrl}>
  {#snippet empty()}
    <p class="text-gray-400">请选择一个 DOCX 文件</p>
  {/snippet}
</DocxViewer>
```

## 加密文档

带打开密码（ECMA-376 Agile 加密）的 .docx 由核心库解密，组件自动弹出密码框；密码错误会在弹窗内提示，取消则回到空态。

## 外部字体

通过 `renderOptions.fonts` 注入 webfont。字体族名必须与文档内部引用一致（中文文档常直接引用中文族名，如 `宋体`），别名需列为单独条目：

```svelte
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

[Svelte Viewer Demo](https://apollocmh.github.io/docx-preview/demos/svelte/) · [文档站](https://apollocmh.github.io/docx-preview/)

## License

Apache-2.0 · 基于 docxjs（见仓库 NOTICE）
