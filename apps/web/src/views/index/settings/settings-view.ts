import { useAuthUseCase, useUserUseCase } from '@/hooks'
import { useUserStore } from '@nao-todo/presentation-identity'
import { inject, provide } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '../context'
import { SETTINGS_VIEW_CONTEXT_KEY } from './context'

const useSettingsView = () => {
    // @contexts（仅 UI/服务；业务依赖下方本地组装）
    const { isDisplayAside, isUseFloatAside, switchDisplayAside, appSubscriber, appDialogManager } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @usecases 业务依赖本地组装（DI 入口；不来自父视图上下文）
    const userUseCase = useUserUseCase(userStore)
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