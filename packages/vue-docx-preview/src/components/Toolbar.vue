<script setup lang="ts">
import { inject, ref } from 'vue';
import { DOCX_VIEWER_KEY } from '../context';
import IconThumbs from './icons/IconThumbs.vue';
import IconPrevPage from './icons/IconPrevPage.vue';
import IconNextPage from './icons/IconNextPage.vue';
import IconZoomOut from './icons/IconZoomOut.vue';
import IconZoomIn from './icons/IconZoomIn.vue';
import IconChevronDown from './icons/IconChevronDown.vue';
import IconOpenFile from './icons/IconOpenFile.vue';
import IconDownload from './icons/IconDownload.vue';

const api = inject(DOCX_VIEWER_KEY)!;
const {
  docLoaded,
  pagerShown,
  canPrev,
  canNext,
  currentPage,
  pageCount,
  canZoomOut,
  canZoomIn,
  scaleLabel,
  scaleMode,
  dropdownOpen,
  thumbsShown,
} = api;
const { goToPage, jumpToPage, zoomStep, setScaleMode, toggleThumbs, download, open } = api;

const scales = ['fit', '0.5', '0.75', '1', '1.25', '1.5', '2'];

function onJump(event: Event) {
  const input = event.target as HTMLInputElement;
  jumpToPage(input.value);
  input.blur();
}

const fileInput = ref<HTMLInputElement>();

function pickFile() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files && input.files[0];
  if (file) open(file);
  // Reset so picking the same file twice still fires change.
  input.value = '';
}
</script>

<template>
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
        <button class="tbtn" type="button" title="上一页" :disabled="!canPrev" @click="goToPage(currentPage - 1)">
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
        <button class="tbtn" type="button" title="下一页" :disabled="!canNext" @click="goToPage(currentPage + 1)">
          <IconNextPage />
        </button>
      </span>
    </div>

    <div class="toolbar-center">
      <div class="zoom-group">
        <button class="tbtn" type="button" title="缩小" :disabled="!canZoomOut" @click="zoomStep(-1)">
          <IconZoomOut />
        </button>
        <div class="scale-select">
          <button class="tbtn scale-display" type="button" @click.stop="dropdownOpen = !dropdownOpen">
            <span>{{ scaleLabel }}</span>
            <IconChevronDown />
          </button>
          <div class="dropdown" :hidden="!dropdownOpen">
            <button
              v-for="s in scales"
              :key="s"
              type="button"
              :class="{ selected: (scaleMode === 'fit' && s === 'fit') || String(scaleMode) === s }"
              @click="setScaleMode(s)"
            >
              {{ s === 'fit' ? '适应宽度' : Math.round(parseFloat(s) * 100) + '%' }}
            </button>
          </div>
        </div>
        <button class="tbtn" type="button" title="放大" :disabled="!canZoomIn" @click="zoomStep(1)">
          <IconZoomIn />
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <button class="tbtn" type="button" title="打开文档" @click="pickFile">
        <IconOpenFile />
      </button>
      <button class="tbtn" type="button" title="下载文档" :disabled="!docLoaded" @click="download">
        <IconDownload />
      </button>
      <input ref="fileInput" type="file" accept=".docx" hidden @change="onFileChange" />
    </div>
  </header>
</template>
