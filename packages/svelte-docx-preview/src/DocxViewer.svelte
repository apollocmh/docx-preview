<script lang="ts">
  // Svelte 5 DOCX viewer component — WPS-style toolbar, pager, zoom,
  // thumbnails and page corners. The whole chrome lives in this one file
  // (mirroring the vue/react wrappers); reactive state and the DOM work that
  // can't be expressed declaratively are in ./composables/useDocViewer.svelte,
  // the icons in ./components/icons.
  import { untrack } from 'svelte'
  import { useDocViewer } from './composables/useDocViewer.svelte'
  import type { DocxViewerProps } from './types'
  import IconThumbs from './components/icons/IconThumbs.svelte'
  import IconPrevPage from './components/icons/IconPrevPage.svelte'
  import IconNextPage from './components/icons/IconNextPage.svelte'
  import IconZoomOut from './components/icons/IconZoomOut.svelte'
  import IconZoomIn from './components/icons/IconZoomIn.svelte'
  import IconChevronDown from './components/icons/IconChevronDown.svelte'
  import IconOpenFile from './components/icons/IconOpenFile.svelte'
  import IconDownload from './components/icons/IconDownload.svelte'
  import './styles/viewer.css'

  let {
    url = null,
    customRequest,
    name,
    initialScale,
    showThumbs,
    renderOptions,
    empty,
    class: className = '',
    onRendered,
    onError,
  }: DocxViewerProps = $props()

  const SCALES = ['fit', '0.5', '0.75', '1', '1.25', '1.5', '2']

  // Element refs (bind:this fills them after mount).
  let stage = $state<HTMLElement>()
  let docBox = $state<HTMLDivElement>()
  let thumbs = $state<HTMLElement>()
  let fileInput = $state<HTMLInputElement>()

  const api = useDocViewer(
    { stage: () => stage, docBox: () => docBox, thumbs: () => thumbs },
    // Getters keep the options live: the composable reads them per call, so a
    // parent that swaps a callback (or renderOptions) isn't stuck with the
    // initial one. `initialScale` / `showThumbs` are mount-time only by design.
    {
      get initialScale() {
        return initialScale
      },
      get showThumbs() {
        return showThumbs
      },
      get renderOptions() {
        return renderOptions
      },
      get onRendered() {
        return onRendered
      },
      get onError() {
        return onError
      },
    },
  )

  const hasUrl = $derived(typeof url === 'string' && url.length > 0)
  const showEmpty = $derived(!hasUrl && !api.loading)

  // ── 密码弹窗（加密文档） ──
  let passwordValue = $state('')
  let passwordInput = $state<HTMLInputElement>()

  $effect(() => {
    if (!api.passwordPrompt) return
    // 打开弹窗、以及密码错误后回到输入态时，清空并重新聚焦
    passwordValue = ''
    passwordInput?.focus()
  })

  async function onPasswordSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!passwordValue) {
      passwordInput?.focus()
      return
    }
    await api.submitPassword(passwordValue)
    passwordInput?.focus()
  }

  // 文档身份变化即重新加载（对齐 vue 版 `watch([url, name])`）。
  // untrack：渲染过程会读元素引用，但这些引用不属于「文档身份」，
  // 不能因为它们挂载时被赋值就再触发一次加载。
  $effect(() => {
    const nextUrl = url
    const nextName = name
    const shouldLoad = hasUrl
    untrack(() => {
      if (shouldLoad && nextUrl) api.openUrl(nextUrl, customRequest, nextName)
      else api.close()
    })
  })

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) api.open(file)
    // Reset so picking the same file twice still fires change.
    input.value = ''
  }

  function onJump(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    api.jumpToPage(input.value)
    input.blur()
  }

  function onJumpKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') onJump(event)
  }

  function onThumbClick(event: MouseEvent) {
    const item = (event.target as HTMLElement).closest('.thumb')
    if (item) api.goToPage(Number(item.getAttribute('data-page')))
  }
</script>

<div class={className ? `docx-viewer ${className}` : 'docx-viewer'}>
  <header class="toolbar" hidden={!api.docLoaded}>
    <div class="toolbar-left">
      <button
        class={api.thumbsShown ? 'tbtn active' : 'tbtn'}
        type="button"
        title="缩略图"
        disabled={!api.docLoaded || api.pageCount <= 1}
        onclick={() => api.toggleThumbs()}
      >
        <IconThumbs />
      </button>
      <span class="toolbar-divider"></span>
      <span class="pager" hidden={!api.pagerShown}>
        <button
          class="tbtn"
          type="button"
          title="上一页"
          disabled={!api.canPrev}
          onclick={() => api.goToPage(api.currentPage - 1)}
        >
          <IconPrevPage />
        </button>
        <span class="page-info">
          <!-- keyed by page: a page change remounts the input with the fresh number -->
          {#key api.currentPage}
            <input
              class="page-input"
              type="number"
              min="1"
              step="1"
              value={api.pageCount > 0 ? api.currentPage + 1 : ''}
              aria-label="当前页码"
              onkeydown={onJumpKeydown}
              onblur={onJump}
            />
          {/key}
          <span class="page-total">/ {api.pageCount > 0 ? api.pageCount : '–'}</span>
        </span>
        <button
          class="tbtn"
          type="button"
          title="下一页"
          disabled={!api.canNext}
          onclick={() => api.goToPage(api.currentPage + 1)}
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
          disabled={!api.canZoomOut}
          onclick={() => api.zoomStep(-1)}
        >
          <IconZoomOut />
        </button>
        <div class="scale-select">
          <button
            class="tbtn scale-display"
            type="button"
            onclick={(event) => {
              event.stopPropagation()
              api.toggleDropdown()
            }}
          >
            <span>{api.scaleLabel}</span>
            <IconChevronDown />
          </button>
          <div class="dropdown" hidden={!api.dropdownOpen}>
            {#each SCALES as scale (scale)}
              <button
                type="button"
                class={(api.scaleMode === 'fit' && scale === 'fit') ||
                String(api.scaleMode) === scale
                  ? 'selected'
                  : undefined}
                onclick={() => api.setScale(scale)}
              >
                {scale === 'fit' ? '适应宽度' : Math.round(parseFloat(scale) * 100) + '%'}
              </button>
            {/each}
          </div>
        </div>
        <button
          class="tbtn"
          type="button"
          title="放大"
          disabled={!api.canZoomIn}
          onclick={() => api.zoomStep(1)}
        >
          <IconZoomIn />
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <button class="tbtn" type="button" title="打开文档" onclick={() => fileInput?.click()}>
        <IconOpenFile />
      </button>
      <button class="tbtn" type="button" title="下载文档" disabled={!api.docLoaded} onclick={api.download}>
        <IconDownload />
      </button>
      <input bind:this={fileInput} type="file" accept=".docx" hidden onchange={onFileChange} />
    </div>
  </header>

  <div class="error-banner" hidden={!api.error}>
    <strong>{api.error?.title}</strong>
    <span>{api.error?.detail}</span>
  </div>

  <div class="body">
    <!-- 缩略图侧栏的点击由内部 .thumb 命中测试处理（与 vue/react 版一致），
         它不是可聚焦控件，因此关掉 a11y 的非交互元素告警。 -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <aside bind:this={thumbs} class="thumbs" hidden={!api.thumbsShown} aria-label="页面缩略图" onclick={onThumbClick}></aside>

    <main bind:this={stage} class="stage">
      <div class="loading" hidden={!api.loading}>
        <div class="spinner"></div>
        <p>加载中…</p>
      </div>

      <!-- The library renders into this box; hidden while there is no URL. -->
      <div bind:this={docBox} class="document" hidden={!hasUrl}></div>

      {#if showEmpty}
        <div class="empty">
          {#if empty}
            {@render empty()}
          {:else}
            <div class="empty-default"><p>暂无预览文档</p></div>
          {/if}
        </div>
      {/if}
    </main>
  </div>

  <!-- 加密文档：密码弹窗 -->
  {#if api.passwordPrompt}
    <div class="password-modal" role="dialog" aria-modal="true" aria-label="文档需要密码">
      <form class="password-card" onsubmit={onPasswordSubmit}>
        <h2 class="password-title">文档已加密</h2>
        <p class="password-hint">「{api.passwordPrompt.fileName}」需要密码才能打开。</p>
        <input
          bind:this={passwordInput}
          bind:value={passwordValue}
          class="password-input"
          type="password"
          autocomplete="current-password"
          placeholder="请输入文档密码"
          disabled={api.passwordPrompt.busy}
          onkeydown={(event) => {
            if (event.key === 'Escape') api.cancelPassword()
          }}
        />
        <p class="password-error" hidden={!api.passwordPrompt.wrong}>密码不正确，请重试。</p>
        <div class="password-actions">
          <button class="password-btn" type="button" disabled={api.passwordPrompt.busy} onclick={api.cancelPassword}>
            取消
          </button>
          <button class="password-btn primary" type="submit" disabled={api.passwordPrompt.busy}>
            {api.passwordPrompt.busy ? '解密中…' : '确定'}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>
