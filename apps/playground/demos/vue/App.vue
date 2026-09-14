<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { DocxViewer } from '@apollo-design/vue-docx-preview'
import '../../../../packages/vue-docx-preview/dist/style.css'

const fileUrl = ref<string | null>(null)
const fileName = ref('')

function release(url: string | null | undefined) {
  if (url) URL.revokeObjectURL(url)
}

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const next = URL.createObjectURL(file)
  const prev = fileUrl.value

  fileUrl.value = next
  fileName.value = file.name

  // 等新一轮渲染/加载真正开始后再释放旧 URL
  nextTick(() => release(prev))

  input.value = ''
}

onBeforeUnmount(() => release(fileUrl.value))
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <header class="bg-white shadow-sm p-4 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-800">Vue DOCX 预览</h1>
      <label
        class="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        选择 DOCX 文件
        <input type="file" accept=".docx" @change="handleFileChange" class="hidden" />
      </label>
    </header>

    <main class="flex-1 min-h-0 p-4">
      <!-- 不再需要 v-if：url 为 null 时组件内部显示空态 -->
      <DocxViewer
        :url="fileUrl"
        :name="fileName"
        class="w-full h-full rounded-lg shadow-lg overflow-hidden"
        @rendered="() => console.log('渲染完成')"
        @error="(err) => console.error('渲染错误', err)"
      >
        <!-- 自定义空态（默认是「暂无预览文档」） -->
        <template #empty>
          <div class="flex flex-col items-center gap-2">
            <p class="text-gray-400 text-lg">请选择一个 DOCX 文件</p>
            <p class="text-gray-300 text-sm">支持 .docx 格式</p>
          </div>
        </template>
      </DocxViewer>
    </main>
  </div>
</template>
