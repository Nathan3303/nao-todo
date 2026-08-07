import '@/themes'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n, initRequester } from '@nao-todo/shared'
import AppRoot from './AppRoot.vue'
import router from '@/router'
import { env } from '@/env'

// 初始化网络请求器
initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })

createApp(AppRoot).use(NueUI).use(createPinia()).use(router).use(i18n).mount('#app')