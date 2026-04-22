import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initRequester } from '@nao-todo/infrastructure/requester'
import router from './router'
import NueUI from 'nue-ui'
import App from './App.vue'
import '@/infrastructure/themes'
import { useThemeStore } from '@/stores'
import { env } from '@/infrastructure/constants/env'

initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)

// Initialize theme store
const themeStore = useThemeStore()
themeStore.loadSavedTheme()
themeStore.initSystemListener()

app.mount('#app')

