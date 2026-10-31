import { registerAppCommands } from '@/commands/app.commands'
import { scopeManager } from '@/commands/instance'
import { env } from '@/env'
import { useKeyboardShortcuts } from '@/hooks'
import router from '@/router'
import { startWebDataPlane } from '@/data-plane'
import { useLocaleStore, useThemeStore, useUserStore } from '@nao-todo/presentation-identity'
import { initRequester } from '@nao-todo/shared/requester'
import { installSessionEnd } from './session-end'
import { t } from '@nao-todo/shared/locales'
import { useResponsiveFlag } from '@nao-todo/shared/hooks'
import { provide } from 'vue'
import { APP_CONTEXT_KEY, type RouterLink } from './context'

const useApp = () => {
    // @initialize 执行 App 初始化动作
    ;(() => {
        // 初始化网络请求器
        initRequester({
            name: 'AxiosRequester',
            baseURL: env.apiBaseURL,
            // T558：失效响应必须与**当前** token 一致才登出（陈旧响应 / `Bearer null` 只记录）
            getAuthToken: () => useUserStore().userToken || null
        })
        // D1/D4：会话结束只有一处执行点（清理矩阵 + 回登录页）；两端注册同一个处理者
        installSessionEnd(router)
        // 加载本地的用户主题偏好 - 应该是先应用本地数据在加载服务器数据
        const themeStore = useThemeStore()
        themeStore.loadSavedTheme()
        themeStore.initSystemListener()
        //  加载本地的用户语言偏好
        const localeStore = useLocaleStore()
        localeStore.loadSavedLanguage()
        // 初始化快捷键系统
        scopeManager.enter('global')
        registerAppCommands()
        useKeyboardShortcuts()
        // C-66 / AC8：web 数据面接线 —— 每次进入应用（`bootstrapLocalData` 之后）后台启动一次
        // `syncService`（`router.afterEach` 覆盖登录/切换账号；`isReady` 覆盖首次进入）。
        // 不在 `beforeEnter` 内调用：那里 requester 未必已初始化（`initRequester` 在 App setup 同步执行）。
        router.afterEach(() => {
            startWebDataPlane()
        })
        void router.isReady().then(() => {
            startWebDataPlane()
        })
    })()

    // @computed 应用侧边栏链接数组
    const routerLinks: RouterLink[] = [
        { name: t('nav.tasks'), icon: 'ntd-logo1', route: '/tasks', routeName: 'tasks' },
        {
            name: t('nav.calendar'),
            icon: 'ntd-calendar',
            route: '/calendar',
            routeName: 'calendar'
        },
        {
            name: t('nav.pomodoro'),
            icon: 'ntd-fanqie',
            route: '/pomodoro',
            routeName: 'pomodoro'
        },
        {
            name: t('nav.search'),
            icon: 'ntd-search',
            route: '/search',
            routeName: 'search'
        }
    ]

    // 初始化响应式标志
    const { flag } = useResponsiveFlag()

    // @method 提供应用全局上下文
    // @description 提供应用全局上下文，用于在应用中使用
    provide(APP_CONTEXT_KEY, {
        routerLinks,
        responsiveFlag: flag
    })
}

export default useApp