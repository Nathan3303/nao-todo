import { computed, inject, provide, type Ref } from 'vue'
import type { IndexViewContext } from '@/views/index-view'
import type { SignInValueObject, SignUpValueObject } from '@nao-todo/domain'
import type { GoAsync } from '@nao-todo/types'
import { responsiveTypes } from '@nao-todo/hooks/use-responsive-flag/use-responsive-flag'

export type AuthViewContext = {
    isDisplayAside: Ref<boolean>
    signInExecutor: (signInValueObject: SignInValueObject) => GoAsync<void>
    signUpExecutor: (signUpValueObject: SignUpValueObject) => GoAsync<void>
    checkInExecutor: () => GoAsync<void>
}

const useAuthView = () => {
    // @context
    const indexViewCtx = inject<IndexViewContext>('IndexViewContext')!

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return indexViewCtx.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide
    provide<AuthViewContext>('AuthViewContext', {
        isDisplayAside,
        signInExecutor: indexViewCtx.authUseCase.signIn,
        signUpExecutor: indexViewCtx.authUseCase.signUp,
        checkInExecutor: indexViewCtx.authUseCase.checkIn
    })

    // @returns
    return {
        isDisplayAside
    }
}

export default useAuthView
