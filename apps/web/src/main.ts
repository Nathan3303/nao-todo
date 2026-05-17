import '@/infrastructure/themes'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App).use(NueUI).use(createPinia()).use(router).mount('#app')

