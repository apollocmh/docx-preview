# API 参考

只有 **renderAsync** 是稳定 API，定义不会变更。解析与渲染的内部实现随时可能调整。

## renderAsync

```ts
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
        h: ({ ns, tagName, className, style, children, ...props } | Node | string): Node, // 实验性 HTML 渲染钩子
    }): Promise<WordDocument>
```

```ts
defaultOptions: Options; // 默认选项
```

## 分页说明

库在以下情况分页：

- 用户手动插入分页符 `<w:br w:type="page"/>`
- 编辑器应用（如 MS Word）插入的 `<w:lastRenderedPageBreak/>`（需把 `ignoreLastRenderedPageBreak` 设为 `false`）
- 段落页面设置变化（如纵向改横向）

`paginate: true` 则在渲染后按真实版式重排分页（四版查看器均默认启用）。

## 加密文档

带打开密码的 .docx 是 OLE2/CFB 容器而非 zip，需先解密再渲染。支持 ECMA-376 Agile 加密（AES-256-CBC + SHA-512，Word 2010+ / WPS 默认）。

```ts
// 判断文件类型: 'ooxml' | 'encrypted' | 'legacy-binary' | 'unknown'
detectOfficeFileKind(data: Uint8Array | ArrayBuffer): OfficeFileKind

isEncryptedDocx(data: Uint8Array | ArrayBuffer): boolean

// 解密, 返回与原始未加密文件逐字节一致的 Uint8Array, 可直接喂给 renderAsync
// 密码错误抛 DocxPasswordError; 非 Agile 加密抛 DocxEncryptionUnsupportedError
decryptDocx(data: Uint8Array | ArrayBuffer, password: string): Promise<Uint8Array>
```

```ts
import { detectOfficeFileKind, decryptDocx, DocxPasswordError } from '@apollo-design/docx-preview';

const buf = new Uint8Array(await file.arrayBuffer());
if (detectOfficeFileKind(buf) === 'encrypted') {
  const plain = await decryptDocx(buf, password);
  await renderAsync(plain, document.getElementById('container'));
}
```

四版查看器已内置密码弹窗，直接用组件即可，无需自己写这段逻辑。

## 实验性 / 内部 API

可用于渲染前修改文档；`renderAsync = parseAsync + renderDocument`。

```ts
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
