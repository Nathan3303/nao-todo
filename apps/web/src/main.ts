import './themes'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { i18n } from '@nao-todo/shared'
import App from './WebRoot.vue'
import router from './router'
import { nueUI } from './nue-ui-register'
import { installGlobalErrorObservability } from './error-observability'
import { installSignOutBroadcastListener } from './views/auth/sign-out-broadcast'

const app = createApp(App)
app.use(nueUI).use(createPinia()).use(router).use(i18n)
// SHELL-05 C-27：全局未捕获异常可观测（同源单点；desktop 复用同一实现）
installGlobalErrorObservability({ app, router })
// AC16b：多标签登出广播监听（web-only；desktop 入口不安装）
installSignOutBroadcastListener(router)
app.mount('#app')