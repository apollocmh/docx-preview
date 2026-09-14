import { useEffect, useRef, useState } from 'react'
import { DocxViewer } from '@apollo-design/react-docx-preview'
import '@apollo-design/react-docx-preview/style.css'

export default function App() {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  function release(url: string | null | undefined) {
    if (url) URL.revokeObjectURL(url)
  }

  // 卸载时释放最后一个 object URL
  const urlRef = useRef(fileUrl)
  urlRef.current = fileUrl
  useEffect(() => () => release(urlRef.current), [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    const next = URL.createObjectURL(file)
    const prev = fileUrl

    setFileUrl(next)
    setFileName(file.name)

    // 等新一轮渲染/加载真正开始后再释放旧 URL
    queueMicrotask(() => release(prev))

    input.value = ''
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">React DOCX 预览</h1>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
          选择 DOCX 文件
          <input type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
        </label>
      </header>

      <main className="flex-1 min-h-0 p-4">
        {/* 不再需要条件渲染：url 为 null 时组件内部显示空态 */}
        <DocxViewer
          url={fileUrl}
          name={fileName}
          className="w-full h-full rounded-lg shadow-lg overflow-hidden"
          onRendered={() => console.log('渲染完成')}
          onError={(err) => console.error('渲染错误', err)}
          empty={
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-400 text-lg">请选择一个 DOCX 文件</p>
              <p className="text-gray-300 text-sm">支持 .docx 格式</p>
            </div>
          }
        />
      </main>
    </div>
  )
}
