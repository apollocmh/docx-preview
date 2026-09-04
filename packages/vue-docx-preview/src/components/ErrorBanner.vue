<script setup lang="ts">
import { inject } from 'vue';
import { DOCX_VIEWER_KEY } from '../context';

const api = inject(DOCX_VIEWER_KEY)!;
const { error } = api;
</script>

<template>
  <div class="error-banner" :hidden="!error">
    <strong>{{ error?.title }}</strong>
    <span>{{ error?.detail }}</span>
  </div>
</template>
