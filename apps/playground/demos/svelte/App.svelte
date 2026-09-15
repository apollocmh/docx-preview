<script lang="ts">
  import { DocxViewer } from '@apollo-design/svelte-docx-preview'
  import '@apollo-design/svelte-docx-preview/style.css'

  let fileUrl = $state<string | null>(null)
  let fileName = $state('')

  function release(url: string | null) {
    if (url) URL.revokeObjectURL(url)
  }

  // 卸载时释放最后一个 object URL
  $effect(() => {
    const current = fileUrl
    return () => release(current)
  })

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const next = URL.createObjectURL(file)
    const prev = fileUrl

    fileUrl = next
    fileName = file.name

    // 等新一轮渲染/加载真正开始后再释放旧 URL
    queueMicrotask(() => release(prev))

    input.value = ''
  }
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <header class="bg-white shadow-sm p-4 flex items-center justify-between">
    <h1 class="text-xl font-semibold text-gray-800">Svelte DOCX 预览</h1>
    <label
      class="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
    >
      选择 DOCX 文件
      <input type="file" accept=".docx" onchange={handleFileChange} class="hidden" />
    </label>
  </header>

  <main class="flex-1 min-h-0 p-4">
    <!-- 不再需要条件渲染：url 为 null 时组件内部显示空态 -->
    <DocxViewer
      url={fileUrl}
      name={fileName}
      class="w-full h-full rounded-lg shadow-lg overflow-hidden"
      onRendered={() => console.log('渲染完成')}
      onError={(err) => console.error('渲染错误', err)}
    >
      {#snippet empty()}
        <div class="flex flex-col items-center gap-2">
          <p class="text-gray-400 text-lg">请选择一个 DOCX 文件</p>
          <p class="text-gray-300 text-sm">支持 .docx 格式</p>
        </div>
      {/snippet}
    </DocxViewer>
  </main>
</div>
