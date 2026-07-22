import type { UserUseCase } from '@nao-todo/application/user/usecases'
import type { DialogManager } from '@nao-todo/shared'

export type UserRestoreProps = {
    userUseCase: UserUseCase
    dialogManager: DialogManager
}

export type UserRestoreFormData = {
    password: string
    agreed: boolean
}

export type UserRestoreEmits = {
    (e: 'restored'): void
    (e: 'confirm-unrestore'): void
}

