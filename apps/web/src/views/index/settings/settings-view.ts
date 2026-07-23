import { useAuthUseCase } from '@/hooks'
import { useUserStore } from '@nao-todo/presentation/user'
import { inject, provide } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '../context'
import { SETTINGS_VIEW_CONTEXT_KEY } from './context'

const useSettingsView = () => {
    // @contexts
    const {
        userUseCase,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        appSubscriber,
        appDialogManager
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @usecases
    const authUseCase = useAuthUseCase(userStore)

    // @provide Settings view 上下文
    provide(SETTINGS_VIEW_CONTEXT_KEY, {
        authUseCase,
        userUseCase,
        subscriber: appSubscriber,
        dialogManager: appDialogManager,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside
    })
}

export default useSettingsView
