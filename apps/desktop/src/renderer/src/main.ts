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
import { installSessionEnd } from '@/session-end'

// 初始化网络请求器
initRequester({
    name: 'AxiosRequester',
    baseURL: env.apiBaseURL,
    // T558：失效响应必须与**当前** token 一致才登出（陈旧响应 / `Bearer null` 只记录）
    getAuthToken: () => useUserStore().userToken || null
})

// D1/D4：会话结束单点（与 web `app.ts` 注册同一处理者 ⇒ 1 个有效处理者 + 1 个闩）
installSessionEnd(router)

// SHELL-05 C-27：全局未捕获异常可观测（同源单点；与 web 端同一实现）
const app = createApp(AppRoot).use(nueUI).use(createPinia()).use(router).use(i18n)
installGlobalErrorObservability({ app, router })
app.mount('#app')