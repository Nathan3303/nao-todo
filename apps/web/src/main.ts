import './themes'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/shared'
import App from './App.vue'
import router from './router'
import { nueUI } from './nue-ui-register'

createApp(App).use(nueUI).use(createPinia()).use(router).use(i18n).mount('#app')