import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { computed, provide, reactive, type Ref } from 'vue'
import { APP_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

export type AppContext = {
    routerLinks: { name: string; icon: string; route: string; routeName: string }[]
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
}

const useApp = () => {
    // @state Router links
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '设置', icon: 'settings-fill', route: '/settings', routeName: 'settings' }
        // { name: '搜索', icon: 'search2', route: '/search', routeName: 'search' }
    ])

    // @hook 响应式标记
    const { flag } = useResponsiveFlag()

    // @state Header 响应式渲染标记
    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    // @provide App Context
    provide<AppContext>(APP_CONTEXT_KEY, {
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader
    })
}

export default useApp
