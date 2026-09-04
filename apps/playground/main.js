import { renderAsync } from '@apollo-design/docx-preview';

const fileInput = document.getElementById('file');
const status = document.getElementById('status');
const log = document.getElementById('log');
const out = document.getElementById('out');

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  status.textContent = '渲染中…';
  log.textContent = '';
  const started = performance.now();
  try {
    await renderAsync(file, out, undefined, {
      paginate: document.getElementById('opt-paginate').checked,
      experimental: document.getElementById('opt-experimental').checked,
    });
    const pages = out.querySelectorAll('section.docx').length;
    status.textContent = `完成:${file.name}`;
    log.textContent = `耗时 ${Math.round(performance.now() - started)}ms,${pages} 页`;
  } catch (err) {
    status.textContent = '失败';
    log.textContent = String((err && err.stack) || err);
    console.error(err);
  }
});
