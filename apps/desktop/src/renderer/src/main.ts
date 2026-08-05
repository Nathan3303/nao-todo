import '@/themes'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/shared'
import AppRoot from './AppRoot.vue'
import router from '@/router'

createApp(AppRoot).use(NueUI).use(createPinia()).use(router).use(i18n).mount('#app')