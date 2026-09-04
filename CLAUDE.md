# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

pnpm **monorepo**。核心库 `@apollo-design/docx-preview` — renders DOCX as semantic HTML。Own project by apollocmh, forked from docxjs (Volodymyr Baydalka, Apache-2.0; attribution in NOTICE/dist banner, do not remove)。Default branch: **master**。

```text
packages/docx-preview        核心 renderer(唯一发布到 npm 的包;公共 API 入口 src/docx-preview.ts:renderAsync 稳定)
packages/react-docx-preview  React 查看器组件包(TSX:vite lib 构建;hooks/useDocViewer.ts + components/ 拆分;样式 src/styles/viewer.css 从 apps/viewer/viewer.css 机器生成,发布为 dist/style.css)
packages/vue-docx-preview    Vue 3 查看器组件包(SFC <script setup>;composables/useDocViewer.ts + components/ 拆分,同构)
apps/viewer                  standalone browser viewer(GitHub Release zip 分发 + iframe 嵌入;tmp/ 放本地测试文档)
apps/playground              文档+演示站(VitePress docs/ + demos/browser 复用 apps/viewer 实现;GitHub Pages 产物;public/demo.docx 默认预览,public/fonts/font.json 外部字体)
.github/                     CI/CD(release.yml 发版 + npm 发布;pages.yml 部署 apps/playground 站点)
```

## Development

```bash
pnpm install
pnpm test            # 构建库 + 契约检查(dist 不存在时会先构建)
pnpm build           # 库:packages/docx-preview/dist UMD@chrome76 / ES@es2020 × min + d.ts
pnpm build:viewer    # 预览器:apps/viewer/dist/(viewer.html + <version>/ 版本化资源)
pnpm dev             # viewer 开发服务器 → localhost:5173/viewer.html
pnpm dev:playground  # 文档站(VitePress) → localhost:5174/docx-preview/
pnpm dev:demos       # 三个 demo → localhost:5173/docx-preview/demos/*(5174 已代理,两个一起跑导航才通)
pnpm build:site      # Pages 产物:先构建依赖包,再 vitepress build + vite build → apps/playground/.vitepress/dist
npm pack --dry-run --pack-destination /tmp ./packages/docx-preview   # 验证 npm 包文件清单
```

## Release

```bash
cd packages/docx-preview
pnpm version patch   # 或 minor/major;在仓库根自动提交并打 v* tag
git push --follow-tags
```

正式发版由 GitHub Actions 完成(tag == packages/docx-preview version 校验、npm Trusted Publishing、Release 仅 tgz + viewer zip 两个 asset)。master 推送只部署 Pages。react/vue 包装包暂未接入发布流。

## Constraints

- 不提交 build output(各级 `dist/` 已 gitignore)。
- 不破坏公共 API;`renderAsync` 签名稳定。
- 优先使用成熟工具(npm pack、pnpm version、Vite、GitHub 官方 Actions),不重复实现它们已提供的能力。
- UMD/viewer 产物面向 Chrome 76 级旧浏览器:不允许 `?.`/`??`(check-dist.mjs 把关;注意压缩器会把 `cond ? .5 : 1` 折成 `cond?.5:1`,正则用 `/\?\.(?!\d)/`)。
- apps 通过 vite alias 直接引用 `packages/docx-preview/src`(dev HMR + 单文件打包);运行时需要 dist 的场景先 `pnpm build`。
- 分页引擎(src/pagination.ts)测量的节点必须已挂载 DOM(detached 节点无布局,scrollHeight/Range rects 为 0)。
- apps/playground 是两套构建合并:vitepress(文档,.vitepress/config.ts 必须 `vite.configFile:false` 防止误载 demos 的 vite.config.ts 导致 public/ 不拷贝、input 串扰) + vite(demos MPA 追加进同一 dist,emptyOutDir:false)。base 恒为 /docx-preview/。demos/browser 通过 `#viewer` alias 复用 apps/viewer 的 viewer.js/viewer.html(?raw 注入 DOM + body dataset 传 defaultFile/fontsUrl);跨 root 的 `../../` import 构建期解析失败,必须走 alias。
- 维护者手动验证版式,不写单测;临时分析输出放 `docs/agent-tmp/`。
