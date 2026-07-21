import type { UserUseCase } from '@nao-todo/application/user/usecases'

export type UserRestoreProps = {
    userUseCase: UserUseCase
    deletionDeadline?: string | null
}

export type UserRestoreFormData = {
    password: string
    agreed: boolean
}

export type UserRestoreEmits = {
    (e: 'restored'): void
    (e: 'confirm-unrestore'): void
}
