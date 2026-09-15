# @apollo-design/docx-preview

将 DOCX 文档渲染为保留语义的 HTML，附带四种形态的查看器（原生 / Vue / React / Svelte）。

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
- **加密文档密码弹窗**：带打开密码的 .docx（ECMA-376 Agile 加密）由核心库解密，查看器自动弹窗收密码，密码错误在弹窗内提示，取消回到空态
- 文件类型识别：加密 .docx / 普通 .docx / 旧式二进制（老 `.doc`、WPS 默认的 `.wps`）分开处理，后者给出"另存为 .docx"的明确提示，而非报 zip 解析错误


## 四版查看器

| 形态 | 包/入口 | 适用场景 |
|---|---|---|
| **原生（零依赖）** | [在线演示](https://apollocmh.github.io/docx-preview/demos/browser/) / [Release 下载 zip](#独立预览器自行部署) | 不装 npm、iframe 嵌入、任意静态服务器部署 |
| **React** | `@apollo-design/react-docx-preview` | React（≥17）工程内嵌查看器组件 |
| **Vue 3** | `@apollo-design/vue-docx-preview` | Vue 3 工程内嵌查看器组件 |
| **Svelte 5** | `@apollo-design/svelte-docx-preview` | Svelte 5 工程内嵌查看器组件（runes，不支持 Svelte 4） |

四版共享同一套查看器实现（WPS 风格工具栏、缩略图、页角标、分页渲染、密码弹窗）。

### React

```bash
pnpm add @apollo-design/react-docx-preview
```

```jsx
import { DocxViewer } from '@apollo-design/react-docx-preview';
import '@apollo-design/react-docx-preview/style.css';

<DocxViewer url="/files/报告.docx" style={{ height: 600 }} onError={console.error} />
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
  <DocxViewer url="/files/报告.docx" style="height: 600px" @error="console.error" />
</template>
```

### Svelte 5

```bash
pnpm add @apollo-design/svelte-docx-preview
```

```svelte
<script lang="ts">
  import { DocxViewer } from '@apollo-design/svelte-docx-preview'
  import '@apollo-design/svelte-docx-preview/style.css'
</script>

<DocxViewer url="/files/报告.docx" class="h-full" onError={console.error} />
```

组件高度由外部容器决定（内部 `height: 100%`），请为父元素设置高度。

组件 props：`url`（文档地址，默认 GET 读取，变化即重新加载）、`customRequest`（自定义请求，可附加鉴权头）、`name`（下载文件名，缺省取 url 末段）、`initialScale`（`'fit'` 或数字）、`showThumbs`、`renderOptions`（库渲染选项）、`empty`（无文档时的占位内容；React 为 `empty` prop，Vue 为 `#empty` 插槽，Svelte 为 `empty` snippet）；事件：`onRendered` / `onError`（Vue 为 `@rendered` / `@error`）。

`url` 为空且未加载时显示空态；文档带打开密码时四版都会自动弹出密码框。

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

## 在线文档与 Demo（GitHub Pages）

```
https://apollocmh.github.io/docx-preview/
```

站点包含项目文档和四版查看器的在线 Demo（默认加载内置示例文档，也可选择本地 .docx——纯浏览器解析，不上传服务器）：

- [Browser 原生 Demo](https://apollocmh.github.io/docx-preview/demos/browser/)
- [Vue Demo](https://apollocmh.github.io/docx-preview/demos/vue/)
- [React Demo](https://apollocmh.github.io/docx-preview/demos/react/)
- [Svelte Demo](https://apollocmh.github.io/docx-preview/demos/svelte/)

Demo 支持通过 URL 参数加载远程文档（需 CORS）：

```
https://apollocmh.github.io/docx-preview/demos/browser/?file=https://example.com/test.docx
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

预览器同样支持带密码的 .docx：识别到加密文档会弹出密码框，密码正确后继续渲染。旧式二进制文档（老 `.doc`，以及 `.wps`——即便新版 WPS Office 默认仍保存为 OLE2 二进制）会被预先识别并给出"另存为 .docx"的明确提示；只有 OOXML 包可以渲染。

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

## 加密文档（带打开密码的 .docx）

核心库内置解密能力，四版查看器的密码弹窗就是基于它做的。带密码的 .docx 不是 zip，而是 OLE2/CFB 复合文档容器（内含 `EncryptionInfo` + `EncryptedPackage`），无法直接交给 `renderAsync`。

```ts
import {
  detectOfficeFileKind, // (data) => 'ooxml' | 'encrypted' | 'legacy-binary' | 'unknown'
  isEncryptedDocx,
  decryptDocx,
  DocxPasswordError,
  DocxEncryptionUnsupportedError,
} from '@apollo-design/docx-preview';

const buf = new Uint8Array(await file.arrayBuffer());

if (detectOfficeFileKind(buf) === 'encrypted') {
  try {
    const plain = await decryptDocx(buf, password); // Uint8Array，即原始 .docx 字节
    await renderAsync(plain, container);
  } catch (e) {
    if (e instanceof DocxPasswordError) {
      // 密码错误（verifier 校验失败），提示用户重输
    } else if (e instanceof DocxEncryptionUnsupportedError) {
      // 不是 ECMA-376 Agile 加密（如旧版 Office 的 Standard Encryption）
    }
  }
}
```

支持范围与说明：

- 支持 **ECMA-376 Agile 加密**（AES-256-CBC + SHA-512，Word 2010 及之后、WPS 的默认加密方式）；旧版 Standard Encryption 会抛 `DocxEncryptionUnsupportedError`
- `decryptDocx` 输出与原始未加密文件逐字节一致，可直接喂给 `renderAsync`
- 解密在浏览器主线程做，10 万次哈希迭代约数百毫秒；大文档会分片让出主线程，不会长时间卡死 UI
- 不想自己写弹窗时，直接用四版查看器组件/独立预览器即可，它们已内置密码交互

## 分页说明

库在以下情况分页：

- 用户手动插入分页符 `<w:br w:type="page"/>`
- 编辑器应用（如 MS Word）插入的 `<w:lastRenderedPageBreak/>`（需把 `ignoreLastRenderedPageBreak` 设为 `false`）
- 段落页面设置变化（如纵向改横向）

`paginate: true` 则在渲染后按真实版式重排分页（四版查看器均默认启用）。

## 稳定性

只有 **renderAsync** 是稳定 API，定义不会变更。`detectOfficeFileKind` / `isEncryptedDocx` / `decryptDocx` 同样按稳定 API 对待；解析与渲染的内部实现随时可能调整。

## Credits

This project is a heavily modified fork of [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by **Volodymyr Baydalka**, licensed under the Apache License 2.0. Thanks to the original author for the excellent foundation.

Subsequent development (pagination engine, per-script font cascade, floating-table anchoring, encrypted-docx decryption, and the four viewer flavors) by **apollocmh**.

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
