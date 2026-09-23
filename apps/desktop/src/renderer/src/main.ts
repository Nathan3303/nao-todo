import '@/themes'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/shared/locales'
import { initRequester } from '@nao-todo/shared/requester'
import { useUserStore } from '@nao-todo/presentation-identity'
import AppRoot from './AppRoot.vue'
import router from '@/router'
import { env } from '@/env'
import { nueUI } from '@/nue-ui-register'
import { installGlobalErrorObservability } from '@/error-observability'

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

// SHELL-05 C-27：全局未捕获异常可观测（同源单点；与 web 端同一实现）
const app = createApp(AppRoot).use(nueUI).use(createPinia()).use(router).use(i18n)
installGlobalErrorObservability({ app, router })
app.mount('#app')