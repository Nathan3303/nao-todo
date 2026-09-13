import './themes'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/shared'
import App from './App.vue'
import router from './router'
import { nueUI } from './nue-ui-register'
import { installGlobalErrorObservability } from './error-observability'

const app = createApp(App)
app.use(nueUI).use(createPinia()).use(router).use(i18n)
// SHELL-05 C-27：全局未捕获异常可观测（同源单点；desktop 复用同一实现）
installGlobalErrorObservability({ app, router })
app.mount('#app')