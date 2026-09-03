import type { UserUseCase } from '@nao-todo/domain-identity'

// 定义组件的 props 类型
export type UserPasswordUpdaterProps = {
    userUseCase: UserUseCase
}

// 定义组件的 state 类型
export type UserPasswordUpdaterFormData = {
    oldPassword: string
    newPassword: string
    confirmNewPassword: string
}

// 定义组件的事件类型
export type UserPasswordUpdaterEmits = {
    (e: 'signOut'): void
}