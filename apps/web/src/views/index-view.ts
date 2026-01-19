import useAutoChangeTheme from '@/infrastructure/hooks/tasks-view/use-auto-change-theme'
import useUserStore from '@nao-todo/application/web/stores/user-store'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { AuthDomain } from '@nao-todo/domain'
import { UserDomain } from '@nao-todo/domain/user'
import { useResponsiveFlag } from '@nao-todo/hooks'
import { responsiveTypes } from '@nao-todo/hooks/use-responsive-flag/use-responsive-flag'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { computed, provide, reactive, type Reactive, type Ref } from 'vue'

export type IndexViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
    routerLinks: Reactive<{ name: string; icon: string; route: string; routeName: string }[]>
    responsiveFlag: Ref<number>
    isDisplayHeader: Ref<boolean>
}

const useIndexView = () => {
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

    // @hook 主题色自动变化
    useAutoChangeTheme(true)

    // @hook 响应式标记
    const { flag } = useResponsiveFlag()

    // @state Header 响应式渲染标记
    const isDisplayHeader = computed(() => flag.value > responsiveTypes.MOBILE)

    // @privode 提供上下文
    provide<IndexViewContext>('IndexViewContext', {
        authUseCase,
        userUseCase,
        routerLinks,
        responsiveFlag: flag,
        isDisplayHeader
    })

    // @returns
    return {
        userUseCase,
        isDisplayHeader
    }
}

export default useIndexView
