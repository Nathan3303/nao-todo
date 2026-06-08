import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { computed, provide, type Ref } from 'vue'
import { useLocaleStore, useThemeStore } from './stores'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { t } from '@nao-todo/infrastructure/locales'
import { env } from '@/infrastructure/constants/env'
import { initRequester } from '@nao-todo/infrastructure/requester'

export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
}

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
    })()

    // @computed 应用侧边栏链接数组
    const routerLinks = [
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

    // 初始化显示头标志
    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    // 初始化显示侧边栏标志
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(flag, responsiveTypes.MOBILE)

    // @method 提供应用全局上下文
    // @description 提供应用全局上下文，用于在应用中使用
    provide<AppContext>(APP_CONTEXT_KEY, {
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside
    })
}

export default useApp

