import type { UserUseCase } from '@nao-todo/domain-identity'
import type { DialogManager } from '@nao-todo/shared'

export type UserDeactiveProps = {
    userUseCase: UserUseCase
    dialogManager: DialogManager
}

export type UserDeactiveFormData = {
    password: string
    confirmPassword: string
    agreed: boolean
}

export type UserDeactiveEmits = {
    (e: 'deactivated'): void
}