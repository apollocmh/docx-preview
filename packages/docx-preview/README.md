# @apollo-design/docx-preview

将 DOCX 文档渲染为保留语义的 HTML。

> Based on [docxjs](https://github.com/VolodymyrBaydalka/docxjs) by Volodymyr Baydalka (Apache License 2.0).

## 安装

```bash
pnpm add @apollo-design/docx-preview
```

## 用法

```ts
import { renderAsync } from '@apollo-design/docx-preview';

await renderAsync(docData, document.getElementById('container'));
```

传统 script 标签方式（UMD 产物通过全局 `docx` 暴露，jszip 需自行引入为全局 `JSZip`）：

```html
<script src="https://unpkg.com/jszip/dist/jszip.min.js"></script>
<script src="node_modules/@apollo-design/docx-preview/dist/docx-preview.min.js"></script>
<script>
  docx.renderAsync(docData, document.getElementById('container'));
</script>
```

## 选项亮点

- `paginate: true` — 渲染后按真实版式重排分页（表格按行、段落按行拆分）
- `fonts: [{ name, src, weight?, style? }]` — 注入外部 webfont（公文常用方正字体可通过此注册）
- `breakPages` / `renderHeaders` / `renderFooters` / `renderFootnotes` 等完整选项见仓库 README

## 加密文档（带打开密码的 .docx）

带密码的 .docx 是 OLE2/CFB 容器而非 zip，需先解密再渲染。支持 ECMA-376 Agile 加密（AES-256-CBC + SHA-512，Word 2010+ / WPS 默认）。

```ts
import { detectOfficeFileKind, decryptDocx, DocxPasswordError } from '@apollo-design/docx-preview';

const buf = new Uint8Array(await file.arrayBuffer());

if (detectOfficeFileKind(buf) === 'encrypted') {
  // 返回与原始未加密文件逐字节一致的 Uint8Array，可直接喂给 renderAsync
  const plain = await decryptDocx(buf, password); // 密码错误抛 DocxPasswordError
  await renderAsync(plain, document.getElementById('container'));
}
```

其他导出：`isEncryptedDocx(data)`、`DocxEncryptionUnsupportedError`（非 Agile 加密时抛出）、类型 `OfficeFileKind`。

## 查看器组件

不想自己处理加载、分页、缩放、密码弹窗时，直接用封装好的组件（含 WPS 风格工具栏、缩略图、页角裁切标记、加密文档密码弹窗）：

| 框架 | 包 |
|---|---|
| Vue 3 | `@apollo-design/vue-docx-preview` |
| React ≥17 | `@apollo-design/react-docx-preview` |
| Svelte 5 | `@apollo-design/svelte-docx-preview` |

不装 npm 的场景可用 GitHub Release 里的 `docx-preview-viewer-{version}.zip`，部署到任意静态服务器后 iframe 嵌入。

## 相关资源

- 在线预览器：https://apollocmh.github.io/docx-preview/
- 独立部署预览器（viewer zip）与完整文档：https://github.com/apollocmh/docx-preview

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
