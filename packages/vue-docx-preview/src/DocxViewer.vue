<script setup lang="ts">
// Full DOCX viewer (WPS-style toolbar: pager, zoom, thumbnails, download) —
// a Vue port of apps/viewer. The document is fed via the `data` prop and
// re-renders when it changes; initialScale/showThumbs/renderOptions describe
// the initial mount (like viewer.html's URL params).
import { onMounted, provide, ref, watch } from 'vue';
import type { Options } from '@apollo-design/docx-preview';
import { useDocViewer } from './composables/useDocViewer';
import { DOCX_VIEWER_KEY } from './context';
import Toolbar from './components/Toolbar.vue';
import ErrorBanner from './components/ErrorBanner.vue';
import ThumbnailsSidebar from './components/ThumbnailsSidebar.vue';
import DocumentStage from './components/DocumentStage.vue';
import './styles/viewer.css';

const props = withDefaults(
  defineProps<{
    /** document data — Blob / ArrayBuffer / Uint8Array; re-renders on change */
    data?: Blob | ArrayBuffer | Uint8Array | null;
    /** document name for the download button */
    name?: string;
    /** 'fit' | number (0.75, 75, …) — initial zoom; mount-time only */
    initialScale?: 'fit' | number;
    /** initial thumbnail sidebar visibility; mount-time only */
    showThumbs?: boolean;
    /** library render options, merged over { paginate, experimental } */
    renderOptions?: Partial<Options>;
  }>(),
  { data: null, name: undefined, initialScale: 'fit', showThumbs: true, renderOptions: undefined },
);

const emit = defineEmits<{
  rendered: [result: unknown];
  error: [error: unknown];
}>();

const stage = ref<HTMLElement>();
const docBox = ref<HTMLElement>();
const thumbs = ref<HTMLElement>();

const api = useDocViewer(
  { stage, docBox, thumbs },
  {
    initialScale: props.initialScale === 'fit' ? 'fit' : Number(props.initialScale),
    showThumbs: props.showThumbs,
    renderOptions: props.renderOptions,
    onRendered: (result) => emit('rendered', result),
    onError: (err) => emit('error', err),
  },
);
provide(DOCX_VIEWER_KEY, api);

onMounted(() => {
  if (props.data) api.open(props.data, props.name);
});
watch([() => props.data, () => props.name], () => {
  if (props.data) api.open(props.data, props.name);
});
</script>

<template>
  <div class="docx-viewer">
    <Toolbar />
    <ErrorBanner />
    <div class="body">
      <ThumbnailsSidebar />
      <DocumentStage />
    </div>
  </div>
</template>
