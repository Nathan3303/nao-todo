import { inject, computed, provide } from 'vue'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { useUserStore } from '@/stores'
import { newAuthUseCase } from '@nao-todo/domain/auth'
import { APP_CONTEXT_KEY } from '@/context'
import { AUTH_VIEW_CONTEXT_KEY } from './context'

const useAuthView = () => {
    // @context App 上下文
    const appContext = inject(APP_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @usecase Auth use case
    const authUseCase = newAuthUseCase(userStore)

    // @state isDisplayAside
    const isDisplayAside = computed(() => {
        return appContext.responsiveFlag.value >= responsiveTypes.MOBILE_TABLE
    })

    // @provide Auth view context
    provide(AUTH_VIEW_CONTEXT_KEY, { authUseCase })

    // @returns
    return {
        isDisplayAside
    }
}

export default useAuthView
