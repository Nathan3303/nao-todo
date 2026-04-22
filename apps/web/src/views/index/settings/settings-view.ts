import { useUserStore } from '@/stores'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { inject, provide, type Ref } from 'vue'
import type { IndexViewContext } from '../index-view'
import {
    INDEX_VIEW_CONTEXT_KEY,
    SETTINGS_VIEW_CONTEXT_KEY
} from '@/infrastructure/constants/context-keys'
import { AuthDomain } from '@nao-todo/domain/auth'
import { useAuthRepository } from '@nao-todo/infrastructure/backend/auth/repoImpl'
import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import type { UserUseCase } from '@nao-todo/application/web/usecases/user'
import useSubscriber, { type Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'

export type SettingsViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
    subscriber: Subscriber
    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    handleResizeAside: (newWidth: number) => void
}

const useSettingsView = () => {
    // @context Index view 上下文
    const { userUseCase, isDisplayAside, isUseFloatAside, switchDisplayAside } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @domains
    const requesterImpl = getRequesterImpl()
    const authDomain = new AuthDomain(useAuthRepository(requesterImpl))

    // @usecases
    const authUseCase = new AuthUseCase(authDomain, userStore)

    // @hook 事件订阅器
    const subscriber = useSubscriber()

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')

    // @provide Settings view 上下文
    provide<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY, {
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
