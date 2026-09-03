import type { ThemeMode, UserUseCase } from '@nao-todo/domain-identity'

export type ThemeSetterOption = {
    value: ThemeMode
    label: string
    icon: string
    previewImage: string
}

export type ThemeSetterProps = {
    userUseCase: UserUseCase
}