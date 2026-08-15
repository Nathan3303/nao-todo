import '@/themes'
import NueUI from 'nue-ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n, initRequester } from '@nao-todo/shared'
import { useUserStore } from '@nao-todo/presentation-identity'
import AppRoot from './AppRoot.vue'
import router from '@/router'
import { env } from '@/env'

// 初始化网络请求器
initRequester({
    name: 'AxiosRequester',
    baseURL: env.apiBaseURL,
    // 凭证失效（code 10041：被下线/被同设备重登顶掉/会话过期）：清空登录态并跳转登录页
    onAuthExpired: () => {
        useUserStore().clearAuthData()
        router.replace('/auth/signin')
    }
})

createApp(AppRoot).use(NueUI).use(createPinia()).use(router).use(i18n).mount('#app')