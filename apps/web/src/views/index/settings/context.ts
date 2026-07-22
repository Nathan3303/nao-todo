import type { AuthUseCase } from '@nao-todo/application/auth/usecases'
import type { UserUseCase } from '@nao-todo/application/user/usecases'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

export type SettingsViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase

    subscriber: Subscriber
    dialogManager: DialogManager

    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    handleResizeAside: (newWidth: number) => void
}

export const SETTINGS_VIEW_CONTEXT_KEY: InjectionKey<SettingsViewContext> =
    Symbol('SETTINGS_VIEW_CONTEXT')
