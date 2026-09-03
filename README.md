# @apollo-design/docx-preview

将 DOCX 文档渲染为保留语义的 HTML，并附带一个可 iframe 嵌入的独立预览器。

> Based on [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by Volodymyr Baydalka (Apache License 2.0) — see [Credits](#credits).

## 目标

尽可能保持 HTML 语义地把 DOCX 渲染/转换为 HTML。库的能力受 HTML 本身限制（例如 Google Docs 是把文档绘制成 canvas 图像）。在此之上，本项目的重点是**公文级版式保真**：字体分 script 级联解析、按行重排分页、页眉页脚页码字段、浮动表格置底、Word 2003 兼容两端对齐等。

## 安装

```
npm install @apollo-design/docx-preview
```

包尚未发布到 npm 时，可直接使用 git 依赖：

```
npm install github:apollocmh/docx-preview
```

## 用法

```html
<!-- 库依赖 jszip -->
<script src="https://unpkg.com/jszip/dist/jszip.min.js"></script>
<script src="docx-preview.min.js"></script>
<script>
    var docData = <document Blob>;

    docx.renderAsync(docData, document.getElementById("container"))
        .then(x => console.log("docx: finished"));
</script>
<body>
    ...
    <div id="container"></div>
    ...
</body>
```

## 独立预览器（standalone viewer）

`dist/viewer/viewer.html` 是一个完全自托管、可 iframe 嵌入的阅读器（WPS 风格工具栏：翻页、缩放、下载、缩略图侧栏）。通过 URL 参数加载文档——文件服务器需允许跨域请求（CORS）：

```html
<iframe src="viewer.html?file=https://example.com/document.docx"></iframe>
<!-- 可选初始缩放: 适应宽度(默认) / 自然尺寸百分比 -->
<iframe src="viewer.html?file=...&scale=fit | 75 | 0.75"></iframe>
<!-- 可选初始缩略图侧栏: 显示(默认) / 隐藏 -->
<iframe src="viewer.html?file=...&thumbs=1 | 0"></iframe>
<!-- 可选显式文档名(下载文件名 + 标题),用于媒体库等不透明地址 -->
<iframe src="viewer.html?file=...&filename=report.docx"></iframe>
```

旧式二进制文档（老 `.doc`，以及 `.wps`——即便新版 WPS Office 默认仍保存为 OLE2 二进制）会被预先识别并给出"另存为 .docx"的明确提示；只有 OOXML 包可以渲染。

构建：`npm run build:release`（库产物 + 预览器包）。预览器发布为 `dist/viewer/viewer.html` 加版本化、利于缓存的资源 `dist/viewer/<version>/iie-preview-docx-viewer.min.{js,css}`——JS 是单文件 bundle（jszip + docx-preview + 预览器应用，无需 CDN）。GitHub Releases 附带相同文件：推送 `master` 刷新滚动 `latest` 预发布，`v*` 标签发布正式版。本地开发用 `npm run dev`（Vite dev server，源码改动即时生效）：`http://localhost:5173/viewer.html?file=./tmp/test.docx`。

预览器会把文档重排为真实分页（`paginate` 选项）。字体按三级解析：.docx 内嵌字体 → viewer.html 旁的 `fonts.json` 清单 → 系统字体。清单是注入为 `@font-face` 的 webfont 定义数组：

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

`paginate: true` 则在渲染后按真实版式重排分页（推荐配合 viewer 使用）。

## 构建与开发

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite dev server，开发预览器（HMR） |
| `npm run build` | 库四产物（UMD/ES × 普通/压缩）+ 类型声明 |
| `npm run build:viewer` | 预览器包（dist/viewer/） |
| `npm run build:release` | 库 + 预览器 + 契约检查（CI 用） |
| `npm run test:package` | 发布门禁：产物存在性、UMD 旧浏览器语法契约、ES 导出冒烟 |
| `npm run watch` | 库构建 watch 模式 |

构建基于 Vite 8（Rolldown 内核）：UMD 产物经 Oxc 降级到 Chrome 76 语法（无 polyfill），ES 产物保留 ES2020。类型声明由 vite-plugin-dts + API Extractor 聚合为单一 `dist/docx-preview.d.ts`。

## 稳定性

只有 **renderAsync** 是稳定 API，定义不会变更。解析与渲染的内部实现随时可能调整。

## Credits

This project is a heavily modified fork of [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by **Volodymyr Baydalka**, licensed under the Apache License 2.0. Thanks to the original author for the excellent foundation.

Subsequent development (pagination engine, per-script font cascade, floating-table anchoring, the standalone viewer, and the Vite 8 build) by **apollocmh**.

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
