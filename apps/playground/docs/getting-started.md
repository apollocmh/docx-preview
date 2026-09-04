# 快速开始

## 安装

::: code-group

```bash [核心库]
pnpm add @apollo-design/docx-preview
```

```bash [React 查看器]
pnpm add @apollo-design/react-docx-preview
```

```bash [Vue 查看器]
pnpm add @apollo-design/vue-docx-preview
```

:::

## 核心库

```ts
import { renderAsync } from '@apollo-design/docx-preview';

await renderAsync(docData, document.getElementById('container'));
```

`docData` 支持 `Blob | ArrayBuffer | Uint8Array`（JSZip.loadAsync 支持的任意类型）。

也支持传统 script 标签方式（UMD 产物通过全局 `docx` 暴露，jszip 需自行引入为全局 `JSZip`）：

```html
<script src="https://unpkg.com/jszip/dist/jszip.min.js"></script>
<script src="node_modules/@apollo-design/docx-preview/dist/docx-preview.min.js"></script>
<script>
  docx.renderAsync(docData, document.getElementById('container'));
</script>
```

## React

```jsx
import { DocxViewer } from '@apollo-design/react-docx-preview';
import '@apollo-design/react-docx-preview/style.css';

<DocxViewer url="/files/报告.docx" style={{ height: 600 }} onError={console.error} />
```

## Vue 3

```vue
<script setup>
import { DocxViewer } from '@apollo-design/vue-docx-preview';
import '@apollo-design/vue-docx-preview/style.css';
</script>

<template>
  <DocxViewer url="/files/报告.docx" style="height: 600px" @error="console.error" />
</template>
```

查看器组件通过 `url` 加载文档（默认 GET；需要鉴权时用 `customRequest` 自定义请求），`url` 变化即重新加载。

## 外部字体

通过 `fonts` 选项注入 webfont（React/Vue 组件经 `renderOptions` 透传）。字体族名必须与文档内部引用一致（中文文档常直接引用中文族名，如 `宋体`），别名需列为单独条目：

```ts
await renderAsync(docData, container, undefined, {
  fonts: [
    { name: 'SimSun', src: 'url(fonts/simsun.woff2) format("woff2")' },
    { name: '宋体', src: 'url(fonts/simsun.woff2) format("woff2")' },
  ],
});
```
