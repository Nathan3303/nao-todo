import { useUserStore } from '@/stores'
import { inject, provide } from 'vue'
import { newAuthUseCase } from '@nao-todo/usecases/auth'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { INDEX_VIEW_CONTEXT_KEY } from '../context'
import { SETTINGS_VIEW_CONTEXT_KEY } from './context'

const useSettingsView = () => {
    // @context Index view 上下文
    const { userUseCase, isDisplayAside, isUseFloatAside, switchDisplayAside, subscriber } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    // @usecases
    const userStore = useUserStore()
    const authUseCase = newAuthUseCase(userStore)

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')

    // @provide Settings view 上下文
    provide(SETTINGS_VIEW_CONTEXT_KEY, {
        authUseCase,
        userUseCase,
        subscriber,
        asideWidth,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        handleResizeAside
    })
}

export default useSettingsView

