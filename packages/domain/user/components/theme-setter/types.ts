import type { ThemeMode } from "../../types"
import { UserUseCase } from "../../usecases"

export type ThemeSetterOption = {
    value: ThemeMode
    label: string
    icon: string
    previewImage: string
}

export type ThemeSetterProps = {
    userUseCase: UserUseCase
}
