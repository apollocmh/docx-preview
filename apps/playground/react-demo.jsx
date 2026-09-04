import { createRoot } from 'react-dom/client';
import { createElement, useState } from 'react';
import { DocxViewer } from '@apollo-design/react-docx-preview';
import '@apollo-design/react-docx-preview/style.css';

function App() {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');

  document.getElementById('file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setData(file);
      setName(file.name);
    }
  });

  // Optional ?file= for quick checks: react-demo.html?file=./x.docx
  const fileParam = new URLSearchParams(location.search).get('file');
  if (fileParam && !data) {
    fetch(fileParam)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        setData(buf);
        setName(fileParam.split('/').pop() || '');
      })
      .catch(console.error);
  }

  return createElement(DocxViewer, {
    data,
    name,
    style: { height: '100%' },
    onRendered: () => console.log('REACT RENDERED'),
    onError: (e) => console.error('REACT ERROR', e),
  });
}

createRoot(document.getElementById('root')).render(createElement(App));
