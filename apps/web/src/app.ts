import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { computed, provide, type Ref } from 'vue'
import { useThemeStore } from './stores'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { t } from '@nao-todo/infrastructure/locales'

export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
}

const useApp = () => {
    const themeStore = useThemeStore()

    const routerLinks = computed(() => [
        { name: t('nav.tasks'), icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: t('nav.calendar'), icon: 'calendar2', route: '/calendar', routeName: 'calendar' },
        { name: t('nav.settings'), icon: 'settings-fill', route: '/settings', routeName: 'settings' }
    ]) as unknown as { name: string; icon: string; route: string; routeName: string }[]

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

    // @method 加载本地的用户主题偏好 - 应该是先应用本地数据在加载服务器数据
    const getUserLocalThemeMode = () => {
        themeStore.loadSavedTheme()
        themeStore.initSystemListener()
    }

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

    // @returns
    return { getUserLocalThemeMode }
}

export default useApp


