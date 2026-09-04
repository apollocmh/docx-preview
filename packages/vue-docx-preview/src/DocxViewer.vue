<script setup lang="ts">
// Full DOCX viewer (WPS-style toolbar: pager, zoom, thumbnails, download) —
// a Vue port of apps/viewer. The document is fetched from the `url` prop
// (optionally via `customRequest`, e.g. for authenticated endpoints) and
// re-renders when it changes; initialScale/showThumbs/renderOptions describe
// the initial mount (like viewer.html's URL params).
import { onMounted, provide, ref, watch } from 'vue';
import type { Options } from '@apollo-design/docx-preview';
import { useDocViewer } from './composables/useDocViewer';
import type { DocxCustomRequest } from './composables/useDocViewer';
import { DOCX_VIEWER_KEY } from './context';
import Toolbar from './components/Toolbar.vue';
import ErrorBanner from './components/ErrorBanner.vue';
import ThumbnailsSidebar from './components/ThumbnailsSidebar.vue';
import DocumentStage from './components/DocumentStage.vue';
import './styles/viewer.css';

const props = withDefaults(
  defineProps<{
    /** 文档地址,默认 GET 读取;变化即重新加载 */
    url: string;
    /** 自定义请求(可附加鉴权头等),返回文档数据;缺省用 fetch GET */
    customRequest?: DocxCustomRequest;
    /** document name for the download button; defaults to the URL's last path segment */
    name?: string;
    /** 'fit' | number (0.75, 75, …) — initial zoom; mount-time only */
    initialScale?: 'fit' | number;
    /** initial thumbnail sidebar visibility; mount-time only */
    showThumbs?: boolean;
    /** library render options, merged over { paginate, experimental } */
    renderOptions?: Partial<Options>;
  }>(),
  { customRequest: undefined, name: undefined, initialScale: 'fit', showThumbs: true, renderOptions: undefined },
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
  if (props.url) api.openUrl(props.url, props.customRequest, props.name);
});
watch([() => props.url, () => props.name], () => {
  if (props.url) api.openUrl(props.url, props.customRequest, props.name);
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
