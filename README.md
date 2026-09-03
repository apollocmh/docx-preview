# @apollo-design/docx-preview

将 DOCX 文档渲染为保留语义的 HTML，并附带一个可 iframe 嵌入的独立预览器。

> Based on [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by Volodymyr Baydalka (Apache License 2.0) — see [Credits](#credits).

## 目标

尽可能保持 HTML 语义地把 DOCX 渲染/转换为 HTML。库的能力受 HTML 本身限制（例如 Google Docs 是把文档绘制成 canvas 图像）。在此之上，本项目的重点是**公文级版式保真**：字体分 script 级联解析、按行重排分页、页眉页脚页码字段、浮动表格置底、Word 2003 兼容两端对齐等。

## 三个使用入口

### 1. npm 包（Vite / Vue / React 等工程）

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

### 2. 在线预览器（GitHub Pages）

```
https://apollocmh.github.io/docx-preview/
```

打开后**选择或拖入本地 DOCX 文件**即可预览——文档只在浏览器内解析，不会上传到任何服务器。也支持通过 URL 参数加载远程文档（需 CORS）：

```
https://apollocmh.github.io/docx-preview/?file=https://example.com/test.docx
```

### 3. 独立预览器（自行部署）

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

`paginate: true` 则在渲染后按真实版式重排分页（预览器默认启用）。

## 稳定性

只有 **renderAsync** 是稳定 API，定义不会变更。解析与渲染的内部实现随时可能调整。

## Credits

This project is a heavily modified fork of [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by **Volodymyr Baydalka**, licensed under the Apache License 2.0. Thanks to the original author for the excellent foundation.

Subsequent development (pagination engine, per-script font cascade, floating-table anchoring, and the standalone viewer) by **apollocmh**.

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
