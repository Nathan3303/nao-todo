import type { AuthUseCase } from '@nao-todo/domain/auth'
import type { InjectionKey } from 'vue'

export type AuthViewContext = {
    authUseCase: AuthUseCase
}

export const AUTH_VIEW_CONTEXT_KEY: InjectionKey<AuthViewContext> = Symbol('AUTH_VIEW_CONTEXT')

