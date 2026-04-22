import useAutoChangeTheme from '@/infrastructure/hooks/use-auto-change-theme'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import { AuthDomain } from '@nao-todo/domain/auth'
import useResponsiveFlag, {
    responsiveTypes
} from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import useUserStore from '@/stores/user-store'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { UserDomain } from '@nao-todo/domain/user'

export default defineStore('ViewStore', () => {
    // @usecase 认证用例
    const authUseCase = new AuthUseCase(
        new AuthDomain(useAuthRepository(getRequesterImpl())),
        useUserStore()
    )

    // @usecase 用户用例
    const userUseCase = new UserUseCase(
        new UserDomain(useUserRepository(getRequesterImpl())),
        useUserStore()
    )

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
