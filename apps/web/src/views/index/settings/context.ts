import { AuthUseCase } from '@nao-todo/domain/auth'
import { UserUseCase } from '@nao-todo/domain/user'
import { Subscriber } from '@nao-todo/shared'
import { InjectionKey, Ref } from 'vue'

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

export const SETTINGS_VIEW_CONTEXT_KEY: InjectionKey<SettingsViewContext> =
    Symbol('SETTINGS_VIEW_CONTEXT')
