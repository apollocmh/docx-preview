将 apps/playground 改造为 VitePress 文档 + Playground 一体化站点。

目标：
- apollocmh.github.io/docx-preview/ 使用该项目构建产物
- 一个入口同时提供：
    1. 项目文档
    2. Browser 原生 Viewer Demo
    3. Vue Viewer Demo
    4. React Viewer Demo

目录调整为：

apps/playground
├── .vitepress
├── docs                 # VitePress 文档
├── demos
│   ├── browser          # 原生 JS Viewer Demo（保留 index.html 方案）
│   ├── vue              # Vue Demo
│   └── react            # React Demo
├── public
│   ├── demo.docx
│   └── fonts
│       └── font.json    # 需要在 Viewer 中引入 稍后我自己 补充字体 
└── package.json


要求：
- 使用 VitePress 作为文档入口
- 使用 Tailwind CSS 编写页面 UI
- 保留现有 Browser/Vue/React Demo 功能，不重构核心逻辑
- demos 中的 Demo 可以被 VitePress 导航访问
- public/demo.docx 作为默认预览文件
- public/fonts/font.json 需要加载并传入字体配置
- 支持 pnpm workspace 引用 packages/*
- 构建产物用于 GitHub Pages：
  apollocmh.github.io/docx-preview/
