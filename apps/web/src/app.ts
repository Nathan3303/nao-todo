import { registerAppCommands } from '@/commands/app.commands'
import { scopeManager } from '@/commands/instance'
import { env } from '@/env'
import { useKeyboardShortcuts } from '@/hooks'
import { useLocaleStore, useThemeStore } from '@nao-todo/presentation/user'
import { initRequester, t, useResponsiveFlag } from '@nao-todo/shared'
import { provide } from 'vue'
import { APP_CONTEXT_KEY, type RouterLink } from './context'

const useApp = () => {
    // @initialize 执行 App 初始化动作
    ;(() => {
        // 初始化网络请求器
        initRequester({ name: 'AxiosRequester', baseURL: env.apiBaseURL })
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
        },
        {
            name: t('nav.settings'),
            icon: 'ntd-settings',
            route: '/settings',
            routeName: 'settings'
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
