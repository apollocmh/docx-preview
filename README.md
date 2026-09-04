# @apollo-design/docx-preview

将 DOCX 文档渲染为保留语义的 HTML，附带三种形态的查看器（原生 / Vue / React）。

本项目基于 **[docxjs](https://github.com/VolodymyrBaydalka/docxjs)**（作者 Volodymyr Baydalka，Apache License 2.0）深度改造。

## 相对 docxjs 新增的功能

**渲染与版式（公文级保真）**

- **重排分页引擎**（`paginate` 选项）：渲染后按真实版式把内容回流进页面尺寸的 section——表格按行拆、段落按行拆，续段自动抑制首行缩进与列表编号
- **页码字段**：页眉页脚的 PAGE/NUMPAGES 域按页正确替换（含分页拆分后的克隆页脚）
- **字体保真**：按 script 分离的字体级联（西文/东亚独立继承，run 级 Times New Roman 不再吞掉中文方正字体）；docDefaults 优先级修正；主题东亚字体解析
- **外部字体注入**：`fonts` 选项 / `fonts.json` 清单注入 webfont，三级兜底（docx 内嵌字体 > fonts.json > 系统字体）
- **公文版式**：浮动表格置底（版记行 `tblpYSpec="bottom"`）；右制表位对齐（版记左右分栏行）；Word 2003/WPS 兼容模式（compatibilityMode ≤ 11）下两端对齐段落末行空格拉伸；`atLeast` 行距修正（此前虚高近一倍）

**查看器（viewer）**

- WPS 风格阅读器：翻页器、缩放（适应宽度/百分比）、下载、缩略图侧栏、Office 式页角裁切标记
- 本地上传：选择或拖入 .docx 即预览，纯浏览器解析不上传服务器
- OLE2 二进制识别：老 `.doc` 和 WPS 默认的 `.wps` 给出"另存为 .docx"的明确提示，而非报 zip 解析错误


## 三版查看器

| 形态 | 包/入口 | 适用场景 |
|---|---|---|
| **原生（零依赖）** | [在线演示](https://apollocmh.github.io/docx-preview/) / [Release 下载 zip](#独立预览器自行部署) | 不装 npm、iframe 嵌入、任意静态服务器部署 |
| **React** | `@apollo-design/react-docx-preview` | React 工程内嵌查看器组件 |
| **Vue 3** | `@apollo-design/vue-docx-preview` | Vue 工程内嵌查看器组件 |

三版共享同一套查看器实现（WPS 风格工具栏、缩略图、页角标、分页渲染）。

### React

```bash
pnpm add @apollo-design/react-docx-preview
```

```jsx
import { DocxViewer } from '@apollo-design/react-docx-preview';
import '@apollo-design/react-docx-preview/style.css';

<DocxViewer data={blob} name="报告.docx" style={{ height: 600 }} onError={console.error} />
```

### Vue 3

```bash
pnpm add @apollo-design/vue-docx-preview
```

```vue
<script setup>
import { DocxViewer } from '@apollo-design/vue-docx-preview';
import '@apollo-design/vue-docx-preview/style.css';
</script>

<template>
  <DocxViewer :data="blob" name="报告.docx" style="height: 600px" @error="console.error" />
</template>
```

组件 props：`data`（Blob/ArrayBuffer/Uint8Array，变化即重渲染）、`name`（下载文件名）、`initialScale`（`'fit'` 或数字）、`showThumbs`、`renderOptions`（库渲染选项）；事件：`onRendered` / `onError`（Vue 为 `@rendered` / `@error`）。

## 使用核心库（npm 包）

```bash
pnpm add @apollo-design/docx-preview
```

```ts
import { renderAsync } from '@apollo-design/docx-preview';

await renderAsync(docData, document.getElementById('container'));
```

也支持传统 script 标签方式（UMD 产物通过全局 `docx` 暴露，jszip 需自行引入为全局 `JSZip`）：

```html
<script src="https://unpkg.com/jszip/dist/jszip.min.js"></script>
<script src="node_modules/@apollo-design/docx-preview/dist/docx-preview.min.js"></script>
<script>
    docx.renderAsync(docData, document.getElementById("container"));
</script>
```

## 在线预览器（GitHub Pages）

```
https://apollocmh.github.io/docx-preview/
```

打开后**选择或拖入本地 DOCX 文件**即可预览——文档只在浏览器内解析，不会上传到任何服务器。也支持通过 URL 参数加载远程文档（需 CORS）：

```
https://apollocmh.github.io/docx-preview/?file=https://example.com/test.docx
```

## 独立预览器（自行部署）

从 [GitHub Releases](https://github.com/apollocmh/docx-preview/releases) 下载：

```
docx-preview-viewer-{version}.zip
```

解压后部署到任意静态服务器即可——不依赖 npm、不需要构建工具、无第三方 CDN，通过 iframe 或浏览器直接使用：

```html
<iframe src="/viewer.html?file=https://example.com/document.docx"></iframe>
<!-- 可选初始缩放: 适应宽度(默认) / 自然尺寸百分比 -->
<iframe src="/viewer.html?file=...&scale=fit | 75 | 0.75"></iframe>
<!-- 可选初始缩略图侧栏: 显示(默认) / 隐藏 -->
<iframe src="/viewer.html?file=...&thumbs=1 | 0"></iframe>
<!-- 可选显式文档名(下载文件名 + 标题),用于媒体库等不透明地址 -->
<iframe src="/viewer.html?file=...&filename=report.docx"></iframe>
```

**CORS 注意**：预览器在浏览器内通过 `fetch` 加载 DOCX URL，文件服务器必须允许跨域请求（`Access-Control-Allow-Origin`），或把预览器与文件放在同一来源下。

旧式二进制文档（老 `.doc`，以及 `.wps`——即便新版 WPS Office 默认仍保存为 OLE2 二进制）会被预先识别并给出"另存为 .docx"的明确提示；只有 OOXML 包可以渲染。

预览器会把文档重排为真实分页。字体按三级解析：.docx 内嵌字体 → viewer.html 旁的 `fonts.json` 清单 → 系统字体。清单是注入为 `@font-face` 的 webfont 定义数组：

```json
[
  { "name": "SimSun", "src": "url(fonts/simsun.woff2) format(\"woff2\")" },
  { "name": "宋体", "src": "url(fonts/simsun.woff2) format(\"woff2\")" }
]
```

注意 `name` 必须与文档内部使用的字体族名一致（中文文档常直接引用中文族名，如 `宋体`/`黑体`），别名需列为单独条目。`fonts.json` 缺失或无效时静默忽略。

## API

```ts
// 渲染文档到指定元素
renderAsync(
    document: Blob | ArrayBuffer | Uint8Array, // JSZip.loadAsync 支持的任意类型
    bodyContainer: HTMLElement, // 渲染文档内容的元素
    styleContainer: HTMLElement, // 渲染样式/编号/字体的元素,为 null 时用 bodyContainer
    options: {
        className: string = "docx", // 默认样式与文档样式类的类名/前缀
        inWrapper: boolean = true, // 在文档内容外渲染 wrapper
        hideWrapperOnPrint: boolean = false, // 打印时禁用 wrapper 样式
        ignoreWidth: boolean = false, // 禁用页面宽度渲染
        ignoreHeight: boolean = false, // 禁用页面高度渲染
        ignoreFonts: boolean = false, // 禁用字体渲染
        breakPages: boolean = true, // 在分页符处分页
        paginate: boolean = false, // 渲染后把内容重排进页面尺寸的 section(表格按行、段落按行拆分);测量前会等待 webfont 就绪
        fonts: [{ name: string, src: string, weight?: string|number, style?: string }], // 渲染前注入为 @font-face 的外部 webfont
        ignoreLastRenderedPageBreak: boolean = true, // 禁用 lastRenderedPageBreak 元素分页
        experimental: boolean = false, // 启用实验特性(制表位计算)
        trimXmlDeclaration: boolean = true, // 解析前移除 xml 声明
        useBase64URL: boolean = false, // 图片/字体等转为 base64 URL,否则用 URL.createObjectURL
        renderChanges: false, // 实验性渲染文档修订(插入/删除)
        renderHeaders: true, // 渲染页眉
        renderFooters: true, // 渲染页脚
        renderFootnotes: true, // 渲染脚注
        renderEndnotes: true, // 渲染尾注
        renderComments: false, // 实验性渲染批注
        renderAltChunks: true, // 渲染 altChunks(html 部件)
        debug: boolean = false, // 额外日志
        h: ({ ns, tagName, className, style, children, ...props } | Node | string): Node, // 实验性 HTML 渲染钩子,默认实现见 defaultOptions.h
    }): Promise<WordDocument>

defaultOptions: Options; // 默认选项

/// ==== 实验性 / 内部 API ====
// 可用于渲染前修改文档;renderAsync = parseAsync + renderDocument

// 解析文档,返回内部文档对象
parseAsync(
    document: Blob | ArrayBuffer | Uint8Array,
    options: Options
): Promise<WordDocument>

// 渲染内部文档对象,返回节点列表
renderDocument(
    wordDocument: WordDocument,
    options: Options
): Promise<Node[]>
```

## 分页说明

库在以下情况分页：

- 用户手动插入分页符 `<w:br w:type="page"/>`
- 编辑器应用（如 MS Word）插入的 `<w:lastRenderedPageBreak/>`（需把 `ignoreLastRenderedPageBreak` 设为 `false`）
- 段落页面设置变化（如纵向改横向）

`paginate: true` 则在渲染后按真实版式重排分页（三版查看器均默认启用）。

## 稳定性

只有 **renderAsync** 是稳定 API，定义不会变更。解析与渲染的内部实现随时可能调整。

## Credits

This project is a heavily modified fork of [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by **Volodymyr Baydalka**, licensed under the Apache License 2.0. Thanks to the original author for the excellent foundation.

Subsequent development (pagination engine, per-script font cascade, floating-table anchoring, and the three viewer flavors) by **apollocmh**.

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
