import { inject, computed, provide } from 'vue'
import { responsiveTypes, getRequesterImpl } from '@nao-todo/shared'
import { useUserStore } from '@nao-todo/presentation/user'
import { AuthDomain } from '@nao-todo/domain/auth'
import { AuthUseCase } from '@nao-todo/application/auth/usecases'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { APP_CONTEXT_KEY } from '@/context'
import { AUTH_VIEW_CONTEXT_KEY } from './context'

const useAuthView = () => {
    // @context App 上下文
    const appContext = inject(APP_CONTEXT_KEY)!

    // @usecase Auth use case
    const userStore = useUserStore()
    const requester = getRequesterImpl()
    const authRepo = useAuthRepository(requester)
    const authDomain = new AuthDomain(authRepo)
    const authUseCase = new AuthUseCase(authDomain, userStore)

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return appContext.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide Auth view context
    provide(AUTH_VIEW_CONTEXT_KEY, { authUseCase })

    // @returns
    return { isDisplayAside }
}

export default useAuthView
