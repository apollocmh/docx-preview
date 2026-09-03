# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

`@apollo-design/docx-preview` — renders DOCX as semantic HTML, plus a standalone browser viewer. Own project by apollocmh, forked from docxjs (Volodymyr Baydalka, Apache-2.0; attribution in NOTICE/dist banner, do not remove). Package manager: **pnpm** (pnpm-lock.yaml committed). Default branch: **master**.

```text
src/       核心 renderer(公共 API 入口 src/docx-preview.ts:renderAsync 稳定)
viewer/    standalone browser viewer(Vite app;viewer/tmp/ 放本地测试文档)
scripts/   build-lib.mjs(库矩阵构建)、check-dist.mjs(构建后契约检查)
.github/   CI/CD(release.yml 正式发版 + npm 发布;pages.yml 部署在线 viewer)
```

## Development

```bash
pnpm install
pnpm test          # 构建库 + 契约检查(dist 不存在时会先构建)
pnpm build         # 库:dist/ UMD@chrome76 / ES@es2020 × min + d.ts(vite-plugin-dts)
pnpm build:viewer  # 预览器:viewer-dist/(viewer.html + <version>/ 版本化资源)
pnpm dev           # viewer 开发服务器 → localhost:5173/viewer.html?file=./tmp/x.docx
npm pack --dry-run # 验证 npm 包文件清单
```

## Release

```bash
pnpm version patch   # 或 minor/major;自动提交并打 v* tag
git push --follow-tags
```

正式发版由 GitHub Actions 完成(tag == package.json version 校验、npm Trusted Publishing、Release 仅 tgz + viewer zip 两个 asset)。master 推送只部署 Pages。

## Constraints

- 不提交 build output(`dist/`、`viewer-dist/` 已 gitignore)。
- 不破坏公共 API;`renderAsync` 签名稳定。
- 优先使用成熟工具(npm pack、npm version、Vite、GitHub 官方 Actions),不重复实现它们已提供的能力。
- UMD/viewer 产物面向 Chrome 76 级旧浏览器:不允许 `?.`/`??`(check-dist.mjs 会把关;注意压缩器会把 `cond ? .5 : 1` 折成 `cond?.5:1`,正则用 `/\?\.(?!\d)/`)。
- 分页引擎(src/pagination.ts)测量的节点必须已挂载 DOM(detached 节点无布局,scrollHeight/Range rects 为 0)。
- 修改核心行为必须同步更新 check-dist.mjs 或相关验证。
- 维护者手动验证版式,不写单测;临时分析输出放 `docs/agent-tmp/`。
