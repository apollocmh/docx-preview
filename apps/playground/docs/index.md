# 介绍

`@apollo-design/docx-preview` 将 DOCX 文档渲染为保留语义的 HTML，并附带三种形态的查看器（原生 / Vue / React）。

本项目基于 **[docxjs](https://github.com/VolodymyrBaydalka/docxjs)**（作者 Volodymyr Baydalka，Apache License 2.0）深度改造。

## 相对 docxjs 新增的功能

**渲染与版式（公文级保真）**

- **重排分页引擎**（`paginate` 选项）：渲染后按真实版式把内容回流进页面尺寸的 section——表格按行拆、段落按行拆，续段自动抑制首行缩进与列表编号
- **页码字段**：页眉页脚的 PAGE/NUMPAGES 域按页正确替换（含分页拆分后的克隆页脚）
- **字体保真**：按 script 分离的字体级联（西文/东亚独立继承）；docDefaults 优先级修正；主题东亚字体解析
- **外部字体注入**：`fonts` 选项注入 webfont，三级兜底（docx 内嵌字体 > 外部清单 > 系统字体）
- **公文版式**：浮动表格置底（版记行 `tblpYSpec="bottom"`）；右制表位对齐；Word 2003/WPS 兼容模式下两端对齐段落末行空格拉伸；`atLeast` 行距修正

**查看器（viewer）**

- WPS 风格阅读器：翻页器、缩放（适应宽度/百分比）、下载、缩略图侧栏、Office 式页角裁切标记
- 本地上传：选择或拖入 .docx 即预览，纯浏览器解析不上传服务器
- OLE2 二进制识别：老 `.doc` 和 WPS 默认的 `.wps` 给出"另存为 .docx"的明确提示，而非报 zip 解析错误

## 三版查看器

| 形态 | 包/入口 | 适用场景 |
|---|---|---|
| **原生（零依赖）** | [Browser Demo](/demos/browser/) / [Release 下载 zip](https://github.com/apollocmh/docx-preview/releases) | 不装 npm、iframe 嵌入、任意静态服务器部署 |
| **Vue 3** | `@apollo-design/vue-docx-preview` | Vue 工程内嵌查看器组件 |
| **React** | `@apollo-design/react-docx-preview` | React 工程内嵌查看器组件 |
