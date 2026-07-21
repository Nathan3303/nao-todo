import type { UserUseCase } from '@nao-todo/application/user/usecases'

export type UserDeactiveProps = {
    userUseCase: UserUseCase
}

export type UserDeactiveFormData = {
    password: string
    confirmPassword: string
    agreed: boolean
}

export type UserDeactiveEmits = {
    (e: 'deactivated'): void
}