import type { AuthUseCase } from '@nao-todo/usecases/auth'
import { InjectionKey } from 'vue'

export type AuthViewContext = {
    authUseCase: AuthUseCase
}

export const AUTH_VIEW_CONTEXT_KEY: InjectionKey<AuthViewContext> = Symbol('AUTH_VIEW_CONTEXT')

