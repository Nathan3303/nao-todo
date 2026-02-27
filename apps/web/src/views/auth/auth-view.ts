import { inject, computed, provide } from 'vue'
import { APP_CONTEXT_KEY, AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { useUserStore } from '@/stores'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import { AuthDomain } from '@nao-todo/domain/auth'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { AppContext } from '@/app'
import type { AuthViewContext } from './types'

const useAuthView = () => {
    // @context App 上下文
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @usecase Auth use case
    const authDomain = new AuthDomain(useAuthRepository(getRequesterImpl()))
    const authUseCase = new AuthUseCase(authDomain, userStore)

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return appContext.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide Auth view context
    provide<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY, { authUseCase })

    // @returns
    return {
        isDisplayAside
    }
}

export default useAuthView

