import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initRequester } from '@nao-todo/infrastructure/requester'
import router from './router'
import NueUI from 'nue-ui'
import App from './App.vue'
import '@/infrastructure/themes'

initRequester({ name: 'AxiosRequester', baseURL: 'http://localhost:3302/api' })

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)
app.mount('#app')

