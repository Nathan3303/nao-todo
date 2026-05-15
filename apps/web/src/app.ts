import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { computed, provide, reactive, type Ref } from 'vue'
import { useThemeStore } from './stores'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

/**
 * 应用全局上下文
 */
export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
}

/**
 * 应用全局上下文提供器
 */
const useApp = () => {
    // 初始化主题状态
    const themeStore = useThemeStore()

    // 初始化路由链接
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '日历', icon: 'calendar2', route: '/calendar', routeName: 'calendar' },
        { name: '设置', icon: 'settings-fill', route: '/settings', routeName: 'settings' }
    ])

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


