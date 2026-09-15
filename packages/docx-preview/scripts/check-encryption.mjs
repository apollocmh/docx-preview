// 加密文档解密的冒烟检查（手动跑）：把一份带打开密码的 .docx 放到
// docs/agent-tmp/demo-locked.docx（示例密码 123456），再执行
//   node packages/docx-preview/scripts/check-encryption.mjs
// docs/agent-tmp/ 是 gitignore 的临时区，样本不存在时脚本自动跳过。
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { detectOfficeFileKind, decryptDocx, DocxPasswordError } from '../dist/docx-preview.mjs'

const repo = new URL('../../../', import.meta.url)
const lockedPath = new URL('docs/agent-tmp/demo-locked.docx', repo)
const plainPath = new URL('apps/playground/public/demo.docx', repo)
const legacyPath = new URL('apps/viewer/tmp/2.wps', repo)
const password = process.env.DOCX_PASSWORD || '123456'
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex')

if (!existsSync(lockedPath)) {
  console.log('跳过：缺少加密样本', lockedPath.pathname)
  process.exit(0)
}

const locked = readFileSync(lockedPath)
const plain = readFileSync(plainPath)

console.log('detect(locked) =', detectOfficeFileKind(locked))
console.log('detect(plain)  =', detectOfficeFileKind(plain))
if (existsSync(legacyPath)) {
  console.log('detect(legacy) =', detectOfficeFileKind(readFileSync(legacyPath)))
}

const started = Date.now()
const out = Buffer.from(await decryptDocx(locked, password))
console.log(`decrypt: ${out.length} bytes in ${Date.now() - started}ms | PK 头: ${out.subarray(0, 2).toString()}`)
console.log('与原文件完全一致:', sha(out) === sha(plain))

try {
  await decryptDocx(locked, password + '-wrong')
  console.log('错误密码未被拒绝 ✗')
} catch (error) {
  console.log('错误密码 →', error.name, error instanceof DocxPasswordError ? '✓' : '✗')
}

try {
  await decryptDocx(plain, password)
  console.log('非加密文件未被拒绝 ✗')
} catch (error) {
  console.log('非加密文件 →', error.name, '✓')
}
