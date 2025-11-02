import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import NueUI from 'nue-ui'
import App from './App.vue'
import './themes'

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)
app.mount('#app')

