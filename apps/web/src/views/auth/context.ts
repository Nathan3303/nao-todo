import type { UserUseCase, AuthUseCase } from '@nao-todo/application'
import type { InjectionKey } from 'vue'

export type AuthViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
}

export const AUTH_VIEW_CONTEXT_KEY: InjectionKey<AuthViewContext> = Symbol('AUTH_VIEW_CONTEXT')
