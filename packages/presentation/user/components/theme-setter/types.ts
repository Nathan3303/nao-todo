import type { ThemeMode } from '@nao-todo/application/user/viewobjects'
import type { UserUseCase } from '@nao-todo/application/user/usecases'

export type ThemeSetterOption = {
    value: ThemeMode
    label: string
    icon: string
    previewImage: string
}

export type ThemeSetterProps = {
    userUseCase: UserUseCase
}
