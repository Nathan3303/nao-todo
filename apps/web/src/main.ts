import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initRequester } from '@nao-todo/infrastructure/requester'
import router from './router'
import NueUI from 'nue-ui'
import App from './App.vue'
import '@/infrastructure/themes'
import { useThemeStore, useUserStore } from '@/stores'
import { env } from '@/infrastructure/constants/env'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { loadAndApply } from '@/infrastructure/hooks/use-sync-theme-config'

initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })

const app = createApp(App)
app.use(NueUI)
app.use(createPinia())
app.use(router)

// Initialize theme store
const themeStore = useThemeStore()
themeStore.loadSavedTheme()
themeStore.initSystemListener()

// Load user config from server if authenticated
if (localStorage.getItem('USER_JWT')) {
    const userStore = useUserStore()
    const userUseCase = UserUseCase.create(userStore)
    loadAndApply(userUseCase, (mode) => themeStore.setTheme(mode))
}

app.mount('#app')

