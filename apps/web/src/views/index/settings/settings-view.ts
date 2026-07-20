import { useAuthUseCase } from '@/hooks'
import { useUserStore } from '@nao-todo/presentation/user'
import { useAsideWidth } from '@nao-todo/shared'
import { inject, provide } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '../context'
import { SETTINGS_VIEW_CONTEXT_KEY } from './context'

const useSettingsView = () => {
    // @context Index view 上下文
    const { userUseCase, isDisplayAside, isUseFloatAside, switchDisplayAside, appSubscriber } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    // @usecases
    const userStore = useUserStore()
    const authUseCase = useAuthUseCase(userStore)

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')

    // @provide Settings view 上下文
    provide(SETTINGS_VIEW_CONTEXT_KEY, {
        authUseCase,
        userUseCase,
        subscriber: appSubscriber,
        asideWidth,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        handleResizeAside
    })
}

export default useSettingsView
