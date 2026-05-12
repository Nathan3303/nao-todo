import { env } from '@/infrastructure/constants/env'
import '@/infrastructure/themes'
import { initRequester } from '@nao-todo/infrastructure/requester'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)

app.mount('#app')

