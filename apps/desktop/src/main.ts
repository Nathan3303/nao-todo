import '@/infrastructure/themes'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/infrastructure/locales'
import App from './App.vue'
import router from './router'

createApp(App).use(NueUI).use(createPinia()).use(router).use(i18n).mount('#app')

