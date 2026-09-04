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

## 相关资源

- 在线预览器：https://apollocmh.github.io/docx-preview/
- 独立部署预览器（viewer zip）与完整文档：https://github.com/apollocmh/docx-preview

## License

[Apache License 2.0](LICENSE) — 原始出处声明见 [NOTICE](NOTICE)。
