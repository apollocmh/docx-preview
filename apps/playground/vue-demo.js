import { createApp, h, ref } from 'vue';
import { DocxViewer } from '@apollo-design/vue-docx-preview';
import '@apollo-design/vue-docx-preview/style.css';

const App = {
  setup() {
    const data = ref(null);
    const name = ref('');

    document.getElementById('file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        data.value = file;
        name.value = file.name;
      }
    });

    // Optional ?file= for quick checks: vue-demo.html?file=./x.docx
    const fileParam = new URLSearchParams(location.search).get('file');
    if (fileParam) {
      fetch(fileParam)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          data.value = buf;
          name.value = fileParam.split('/').pop() || '';
        })
        .catch(console.error);
    }

    return () =>
      h(DocxViewer, {
        data: data.value,
        name: name.value,
        style: 'height: 100%',
        onRendered: () => console.log('VUE RENDERED'),
        onError: (e) => console.error('VUE ERROR', e),
      });
  },
};

createApp(App).mount('#app');
