# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

pnpm **monorepo**。核心库 `@apollo-design/docx-preview` — renders DOCX as semantic HTML。Own project by apollocmh, forked from docxjs (Volodymyr Baydalka, Apache-2.0; attribution in NOTICE/dist banner, do not remove)。Default branch: **master**。

```text
packages/docx-preview        核心 renderer(无框架,零依赖除 jszip;公共 API 入口 src/docx-preview.ts:renderAsync 稳定;encryption/ 负责加密文档解析与解密)
packages/react-docx-preview  React 查看器包(单文件 DocxViewer.tsx + hooks/useDocViewer.ts + components/icons/*;vite lib + vite-plugin-dts)
packages/vue-docx-preview    Vue 3 查看器包(单文件 DocxViewer.vue + composables/useDocViewer.ts + components/icons/*,与 react 包同构)
packages/svelte-docx-preview Svelte 5 查看器包(单文件 DocxViewer.svelte + composables/useDocViewer.svelte.ts + components/icons/*;runes,同构)
apps/viewer                  standalone browser viewer(GitHub Release zip 分发 + iframe 嵌入;tmp/ 放本地测试文档)
apps/playground              文档+演示站(VitePress docs/ + demos/{browser,vue,react,svelte} 四个 MPA 入口;GitHub Pages 产物;public/demo.docx 默认预览,public/fonts/font.json 外部字体)
.github/                     CI/CD(release.yml 发版 + npm 发布核心包与三个 wrapper;pages.yml 部署 apps/playground 站点)
```

## Development

```bash
pnpm install
pnpm test            # 构建库 + 契约检查(dist 不存在时会先构建)
pnpm build           # 库:packages/docx-preview/dist UMD@chrome76 / ES@es2020 × min + d.ts
pnpm build:viewer    # 预览器:apps/viewer/dist/(viewer.html + <version>/ 版本化资源)
pnpm dev             # 文档站 5174 + 三个 demo 15175(concurrently;导航里的 demo 链接由 5174 的 proxy 跳到 15175)
pnpm dev:viewer      # standalone viewer → localhost:5173/viewer.html?file=./tmp/test.docx
pnpm build:site      # Pages 产物:先构建依赖包,再 vitepress build + vite build → apps/playground/.vitepress/dist
pnpm typecheck       # pnpm -r typecheck(各包自己的 tsc / vue-tsc)
pnpm format          # prettier --write .(根 .prettierrc.json:semi:false、单引号、printWidth 100)
npm pack --dry-run --pack-destination /tmp ./packages/docx-preview   # 验证 npm 包文件清单
```

## Release

```bash
cd packages/docx-preview
pnpm version patch   # 或 minor/major;在仓库根自动提交并打 v* tag
git push --follow-tags
```

正式发版由 GitHub Actions 完成(tag == packages/docx-preview version 校验、npm Trusted Publishing、Release 仅 tgz + viewer zip 两个 asset)。master 推送只部署 Pages。

三个 wrapper 也由 release.yml 发布:同一个 tag 下,核心包与每个 wrapper 都先 `npm view <name>@<version>`,已存在则跳过、不存在才 `pnpm pack` + `npm publish --provenance`。因此发版是幂等的:重跑或部分成功的发布不会再撞 "cannot publish over previously published version"。wrapper 有改动必须 bump 自己的 version,否则会被跳过。版本策略:核心包 patch/minor,wrapper 新增能力走 minor。

npm Trusted Publishing 是**按包**配置的:每个包都要在 npmjs.com 的 Settings → Trusted Publishers 里绑定 `apollocmh/docx-preview` + `release.yml`(新包还需先手工首发一次把包建出来),漏配的包在 CI 里会报 `ENEEDAUTH`。wrapper 发布循环会收集失败包并在最后统一 `exit 1`,不会因单个包失败连坐后面的包。

## Constraints

- 不提交 build output(各级 `dist/` 已 gitignore)。
- 不破坏公共 API;`renderAsync` 签名稳定。
- 优先使用成熟工具(npm pack、pnpm version、Vite、GitHub 官方 Actions),不重复实现它们已提供的能力。
- UMD/viewer 产物面向 Chrome 76 级旧浏览器:不允许 `?.`/`??`(check-dist.mjs 把关;注意压缩器会把 `cond ? .5 : 1` 折成 `cond?.5:1`,正则用 `/\?\.(?!\d)/`)。
- apps/viewer 通过 vite alias 直接引用 `packages/docx-preview/src`(dev HMR + 单文件打包);运行时需要 dist 的场景先 `pnpm build`。
- 包引用有两条通道:`exports["."].development` → src(vite dev,改源码即热更新),`import` → dist(vite build 与 npm 消费者);所以 dev 下改 `packages/*/src` 立刻生效,`vite build` 用的是 dist,改完源码要重新 `pnpm --filter <pkg> build`。
- **wrapper 必须把框架 external 掉 + 声明 peerDependencies**,否则宿主页面同时存在两份框架实例(Vue 首个 `<slot>` 抛 `Cannot read properties of null (reading 'ce')`,React 抛 `Invalid hook call`)。
- dev 有两套 Vite(文档站 5174 / demo 服务 15175),**一个页面只能由一个实例服务**:`.vitepress/config.ts` 的 `server.proxy` 必须把 `/demos/`、`@fs/<workspace>/packages/`、`node_modules/.vite/` 一起转发到 15175。只转发 `/demos/` 会让库源码落到文档站的 Vite 转译,从而 import 到文档站自己的 vue/react(即上面的双实例崩法)。VitePress 内置的是 Vite 5:proxy 的 `bypass` 返回字符串会 `ERR_STREAM_WRITE_AFTER_END` 崩掉 dev server,不要用它做重定向。
- 查看器组件不拆分:UI 全部内联在单文件组件里(vue `DocxViewer.vue` / react `DocxViewer.tsx`),只有 `components/icons/*` 例外;唯一逻辑层是 `composables|hooks/useDocViewer.ts`。空态 API 两边对齐(vue `#empty` 插槽 / react `empty` prop,`url` 可为空,缺省文案「暂无预览文档」)。
- 样式 `src/styles/viewer.css` 从 `apps/viewer/viewer.css` 机器生成(见文件头注释),vue/react 两份必须逐字节一致;包内 CSS 不带 upload/empty-state 规则,空态靠宿主给的类名。
- 分页引擎(src/pagination.ts)测量的节点必须已挂载 DOM(detached 节点无布局,scrollHeight/Range rects 为 0)。
- apps/playground 是两套构建合并:vitepress(文档,.vitepress/config.ts 必须 `vite.configFile:false` 防止误载 demos 的 vite.config.ts 导致 public/ 不拷贝、input 串扰) + vite(demos MPA 追加进同一 dist,emptyOutDir:false)。base 恒为 /docx-preview/。demos/browser 通过 `#viewer` alias 复用 apps/viewer 的 viewer.js/viewer.html(?raw 注入 DOM + body dataset 传 defaultFile/fontsUrl);跨 root 的 `../../` import 构建期解析失败,必须走 alias。
- 维护者手动验证版式,不写单测;临时分析输出放 `docs/agent-tmp/`。

## 新增/改造一个 wrapper 包

照抄 `packages/vue-docx-preview`(或 `packages/react-docx-preview`、`packages/svelte-docx-preview`)的形状,不要重新设计分层:

```text
<包>/src/DocxViewer.vue|tsx|svelte                 单文件组件:props/事件 + 全部 UI + 空态 + 密码弹窗
<包>/src/composables|hooks/useDocViewer.ts|svelte.ts 状态与命令式 DOM 操作(唯一逻辑层;Svelte 用 runes,.svelte.ts)
<包>/src/components/icons/*                        每图标一个文件
<包>/src/styles/viewer.css                         与其它 wrapper 逐字节一致
<包>/src/index.ts                                  默认导出组件 + 具名别名 + 转出核心库 API 与类型
<包>/vite.config.ts                                lib: formats ['es']、fileName 'index.js'、cssFileName 'style'、sourcemap、target es2020、external 框架与 @apollo-design/docx-preview、vite-plugin-dts
<包>/tsconfig.json + tsconfig.app.json + tsconfig.node.json
<包>/README.md                                     安装 / 用法 / Props 表 / 空态 / 加密文档 / 外部字体 / 在线 Demo / License
```

Svelte 包的两点差异:`.svelte.ts` 里的 runes 需要 `svelte.config.js`(runes: true);TS 读不了 `.svelte`,所以组件旁放一个手写的 `DocxViewer.svelte.d.ts`(`Component<DocxViewerProps>`),typecheck 用 `svelte-check`。

`package.json` 必备:`peerDependencies` 放框架(不放 dependencies)、`dependencies` 放 `@apollo-design/docx-preview: workspace:*`、`exports` 三件套(`.` 带 `development`/`types`/`import`,`./style.css` 带 `development`/`default`,`./package.json`)、`files: ["dist"]`、`sideEffects: ["**/*.css"]`、`type: "module"`、`publishConfig` 指 npm 官方源、`scripts.build = vite build` 与 `scripts.typecheck`。

demo 接入:`apps/playground/demos/<框架>/{index.html, main.<ext>, App.<ext>, style.css}`,`style.css` 只写 `@import 'tailwindcss';`,并把入口加进 `apps/playground/vite.config.ts` 的 `build.rollupOptions.input`(**漏了它 Pages 上就是 404**);demo 直接用组件内置空态,不要再自己条件渲染。

验收顺序:`pnpm --filter <包> typecheck` → `pnpm --filter <包> build`(检查 dist 里没有框架代码)→ `pnpm --filter playground... build`(产物含 `demos/<框架>/index.html`)→ 无头 Chrome 跑 dev(5174)与静态产物两条路径,控制台 0 个 `Uncaught` / `Vue warn` / `Invalid hook call`,空态与文档渲染都正常。
