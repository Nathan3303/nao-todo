import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './routes'
import NueUI from 'nue-ui'

import 'nue-ui/dist/index.css'
import './themes/default.css'

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)
app.mount('#app')
