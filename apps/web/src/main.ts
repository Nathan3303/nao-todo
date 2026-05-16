import { env } from '@/infrastructure/constants/env'
import '@/infrastructure/themes'
import { initRequester } from '@nao-todo/infrastructure/requester'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import useLocaleStore from '@/stores/locale-store'

initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })

const app = createApp(App)
app.use(NueUI)
const pinia = createPinia()
app.use(pinia)
app.use(router)

useLocaleStore().loadSavedLanguage()

app.mount('#app')

