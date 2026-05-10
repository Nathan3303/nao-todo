import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { computed, provide, reactive, type Ref } from 'vue'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
}

const useApp = () => {
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '设置', icon: 'settings-fill', route: '/settings', routeName: 'settings' }
    ])

    const { flag } = useResponsiveFlag()

    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(flag, responsiveTypes.MOBILE)

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

