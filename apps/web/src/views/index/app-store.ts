import useAutoChangeTheme from '@/infrastructure/hooks/use-auto-change-theme'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import useUserStore from '@/stores/user-store'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'

export default defineStore('ViewStore', () => {
    // @usecase 认证用例
    const authUseCase = AuthUseCase.create(useUserStore())

    // @usecase 用户用例
    const userUseCase = UserUseCase.create(useUserStore())

    // @state Router links
    const routerLinks = reactive([
        { name: '任务', icon: 'square-check-fill', route: '/tasks', routeName: 'tasks' },
        { name: '搜索', icon: 'search2', route: '/search', routeName: 'search' }
    ])

    // @hook 响应式标记
    const { flag } = useResponsiveFlag()

    // @state Header 响应式渲染标记
    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    // @hook 主题色自动变化
    useAutoChangeTheme(true)

    // @returns
    return {
        authUseCase,
        userUseCase,
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader
    }
})
