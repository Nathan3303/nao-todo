import { inject, computed, provide } from 'vue'
import { APP_CONTEXT_KEY, AUTH_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AppContext } from '@/app'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { useUserStore } from '@/stores'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import { AuthDomain } from '@nao-todo/domain/auth'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

export type AuthViewContext = {
    signInExecutor: AuthUseCase['signIn']
    signUpExecutor: AuthUseCase['signUp']
    checkInExecutor: AuthUseCase['checkIn']
}

const useAuthView = () => {
    // @context App context
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @dataStore
    const userStore = useUserStore()

    // @usecase Auth use case
    const authUseCase = new AuthUseCase(
        new AuthDomain(useAuthRepository(getRequesterImpl())),
        userStore
    )

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return appContext.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide Auth view context
    provide<AuthViewContext>(AUTH_VIEW_CONTEXT_KEY, {
        signInExecutor: authUseCase.signIn,
        signUpExecutor: authUseCase.signUp,
        checkInExecutor: authUseCase.checkIn
    })

    // @returns
    return {
        isDisplayAside
    }
}

export default useAuthView


