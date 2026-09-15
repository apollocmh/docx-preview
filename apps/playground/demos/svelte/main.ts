import { mount } from 'svelte'
import App from './App.svelte'
import './style.css' // 可选，Tailwind 或自定义样式

mount(App, { target: document.getElementById('root')! })
