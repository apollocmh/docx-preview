<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch, nextTick } from 'vue'
import type { PropType } from 'vue'
import type { Options } from '@apollo-design/docx-preview'
import { useDocViewer } from './composables/useDocViewer'
import type { DocxCustomRequest } from './composables/useDocViewer'
import './styles/viewer.css'

import IconThumbs from './components/icons/IconThumbs.vue'
import IconPrevPage from './components/icons/IconPrevPage.vue'
import IconNextPage from './components/icons/IconNextPage.vue'
import IconZoomOut from './components/icons/IconZoomOut.vue'
import IconZoomIn from './components/icons/IconZoomIn.vue'
import IconChevronDown from './components/icons/IconChevronDown.vue'
import IconOpenFile from './components/icons/IconOpenFile.vue'
import IconDownload from './components/icons/IconDownload.vue'

export default defineComponent({
  name: 'DocxViewer',
  props: {
    url: { type: String as PropType<string | null>, default: null },
    customRequest: { type: Function as PropType<DocxCustomRequest>, default: undefined },
    name: { type: String, default: undefined },
    initialScale: { type: [String, Number] as PropType<'fit' | number>, default: 'fit' },
    showThumbs: { type: Boolean, default: true },
    renderOptions: { type: Object as PropType<Partial<Options>>, default: undefined },
  },
  emits: ['rendered', 'error'],
  components: {
    IconThumbs,
    IconPrevPage,
    IconNextPage,
    IconZoomOut,
    IconZoomIn,
    IconChevronDown,
    IconOpenFile,
    IconDownload,
  },
  setup(props, { emit }) {
    // ── DOM refs ──
    const stage = ref<HTMLElement>()
    const docBox = ref<HTMLElement>()
    const thumbs = ref<HTMLElement>()
    const fileInput = ref<HTMLInputElement>()

    const setStage = (el: any) => {
      stage.value = el || undefined
    }
    const setDocBox = (el: any) => {
      docBox.value = el || undefined
    }
    const setThumbs = (el: any) => {
      thumbs.value = el || undefined
    }
    const setFileInput = (el: any) => {
      fileInput.value = el || undefined
    }

    const {
      loading,
      error,
      docLoaded,
      currentPage,
      pageCount,
      currentScale,
      scaleMode,
      thumbsVisible,
      dropdownOpen,
      pagerShown,
      thumbsShown,
      canPrev,
      canNext,
      canZoomOut,
      canZoomIn,
      scaleLabel,
      open,
      openUrl,
      close,
      goToPage,
      jumpToPage,
      zoomStep,
      setScaleMode,
      toggleThumbs,
      download,
    } = useDocViewer(
      { stage, docBox, thumbs },
      {
        initialScale: props.initialScale === 'fit' ? 'fit' : Number(props.initialScale),
        showThumbs: props.showThumbs,
        renderOptions: props.renderOptions,
        onRendered: (result) => emit('rendered', result),
        onError: (err) => emit('error', err),
      },
    )

    const hasUrl = computed(() => typeof props.url === 'string' && props.url.length > 0)
    const showEmpty = computed(() => !hasUrl.value && !loading.value)

    async function sync() {
      await nextTick()
      if (hasUrl.value && props.url) await openUrl(props.url, props.customRequest, props.name)
      else close()
    }

    onMounted(sync)
    watch([() => props.url, () => props.name], sync, { flush: 'post' })

    function pickFile() {
      fileInput.value && fileInput.value.click()
    }
    function onFileChange(event: Event) {
      const input = event.target as HTMLInputElement
      const file = input.files && input.files[0]
      if (file) open(file)
      input.value = ''
    }
    function onJump(event: Event) {
      const input = event.target as HTMLInputElement
      jumpToPage(input.value)
      input.blur()
    }
    function onThumbClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      const item = target.closest('.thumb') as HTMLElement | null
      if (item) goToPage(Number(item.getAttribute('data-page')))
    }

    return {
      // 状态
      loading,
      error,
      docLoaded,
      currentPage,
      pageCount,
      currentScale,
      scaleMode,
      thumbsVisible,
      dropdownOpen,
      pagerShown,
      thumbsShown,
      canPrev,
      canNext,
      canZoomOut,
      canZoomIn,
      scaleLabel,
      hasUrl,
      showEmpty,
      // refs setter
      setStage,
      setDocBox,
      setThumbs,
      setFileInput,
      // 方法
      pickFile,
      onFileChange,
      onJump,
      onThumbClick,
      goToPage,
      zoomStep,
      setScaleMode,
      toggleThumbs,
      download,
    }
  },
})
</script>

<template>
  <div class="docx-viewer">
    <header class="toolbar" :hidden="!docLoaded">
      <div class="toolbar-left">
        <button
          class="tbtn"
          type="button"
          title="缩略图"
          :class="{ active: thumbsShown }"
          :disabled="!docLoaded || pageCount <= 1"
          @click="toggleThumbs"
        >
          <IconThumbs />
        </button>
        <span class="toolbar-divider"></span>
        <span class="pager" :hidden="!pagerShown">
          <button
            class="tbtn"
            type="button"
            title="上一页"
            :disabled="!canPrev"
            @click="goToPage(currentPage - 1)"
          >
            <IconPrevPage />
          </button>
          <span class="page-info">
            <input
              class="page-input"
              type="number"
              min="1"
              step="1"
              :value="pageCount > 0 ? currentPage + 1 : ''"
              aria-label="当前页码"
              @keydown.enter="onJump"
              @change="onJump"
            />
            <span class="page-total">/ {{ pageCount > 0 ? pageCount : '–' }}</span>
          </span>
          <button
            class="tbtn"
            type="button"
            title="下一页"
            :disabled="!canNext"
            @click="goToPage(currentPage + 1)"
          >
            <IconNextPage />
          </button>
        </span>
      </div>

      <div class="toolbar-center">
        <div class="zoom-group">
          <button
            class="tbtn"
            type="button"
            title="缩小"
            :disabled="!canZoomOut"
            @click="zoomStep(-1)"
          >
            <IconZoomOut />
          </button>
          <div class="scale-select">
            <button
              class="tbtn scale-display"
              type="button"
              @click.stop="dropdownOpen = !dropdownOpen"
            >
              <span>{{ scaleLabel }}</span>
              <IconChevronDown />
            </button>
            <div class="dropdown" :hidden="!dropdownOpen">
              <button
                v-for="s in ['fit', '0.5', '0.75', '1', '1.25', '1.5', '2']"
                :key="s"
                type="button"
                :class="{
                  selected: (scaleMode === 'fit' && s === 'fit') || String(scaleMode) === s,
                }"
                @click="setScaleMode(s)"
              >
                {{ s === 'fit' ? '适应宽度' : Math.round(parseFloat(s) * 100) + '%' }}
              </button>
            </div>
          </div>
          <button
            class="tbtn"
            type="button"
            title="放大"
            :disabled="!canZoomIn"
            @click="zoomStep(1)"
          >
            <IconZoomIn />
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <button class="tbtn" type="button" title="打开文档" @click="pickFile">
          <IconOpenFile />
        </button>
        <button
          class="tbtn"
          type="button"
          title="下载文档"
          :disabled="!docLoaded"
          @click="download"
        >
          <IconDownload />
        </button>
        <input :ref="setFileInput" type="file" accept=".docx" hidden @change="onFileChange" />
      </div>
    </header>

    <div class="error-banner" :hidden="!error">
      <strong>{{ error && error.title }}</strong>
      <span>{{ error && error.detail }}</span>
    </div>

    <div class="body">
      <aside
        :ref="setThumbs"
        class="thumbs"
        :hidden="!thumbsShown"
        aria-label="页面缩略图"
        @click="onThumbClick"
      ></aside>

      <main :ref="setStage" class="stage">
        <div class="loading" :hidden="!loading">
          <div class="spinner"></div>
          <p>加载中…</p>
        </div>

        <div :ref="setDocBox" class="document" v-show="hasUrl"></div>

        <div v-if="showEmpty" class="empty">
          <slot name="empty">
            <div class="empty-default"><p>暂无预览文档</p></div>
          </slot>
        </div>
      </main>
    </div>
  </div>
</template>
