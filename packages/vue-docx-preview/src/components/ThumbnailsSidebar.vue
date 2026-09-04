<script setup lang="ts">
import { inject } from 'vue';
import { DOCX_VIEWER_KEY } from '../context';

const api = inject(DOCX_VIEWER_KEY)!;
const { thumbsShown, thumbs, goToPage } = api;

function onClick(event: MouseEvent) {
  const item = (event.target as HTMLElement).closest('.thumb');
  if (item) goToPage(Number(item.getAttribute('data-page')));
}
</script>

<template>
  <aside :ref="(el) => { thumbs = el as HTMLElement }" class="thumbs" :hidden="!thumbsShown" aria-label="页面缩略图" @click="onClick"></aside>
</template>
