import { inject, computed, provide } from 'vue'
import { responsiveTypes } from '@nao-todo/shared'
import { useUserStore } from '@nao-todo/presentation/user'
import { APP_CONTEXT_KEY } from '@/context'
import { AUTH_VIEW_CONTEXT_KEY } from './context'
import { useAuthUseCase, useUserUseCase } from '@/hooks'

const useAuthView = () => {
    // @context App 上下文
    const appContext = inject(APP_CONTEXT_KEY)!

    // @usecase Auth use case
    const userStore = useUserStore()
    const authUseCase = useAuthUseCase(userStore)

    // @usecase User use case
    const userUseCase = useUserUseCase(userStore)

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return appContext.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide Auth view context
    provide(AUTH_VIEW_CONTEXT_KEY, { authUseCase, userUseCase })

    // @returns
    return { isDisplayAside }
}

export default useAuthView