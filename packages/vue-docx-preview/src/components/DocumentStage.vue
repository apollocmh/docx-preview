<script setup lang="ts">
import { inject } from 'vue';
import { DOCX_VIEWER_KEY } from '../context';

const api = inject(DOCX_VIEWER_KEY)!;
const { stage, docBox, loading } = api;
</script>

<template>
  <main :ref="(el) => { stage = el as HTMLElement }" class="stage">
    <div class="loading" :hidden="!loading">
      <div class="spinner"></div>
      <p>加载中…</p>
    </div>
    <div :ref="(el) => { docBox = el as HTMLElement }" class="document"></div>
  </main>
</template>
