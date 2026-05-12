import type { ThemeMode } from '@/stores'
import type { UserUseCase } from '@nao-todo/application/web/usecases/user'

const appearanceToThemeMode = (appearance: string): ThemeMode => {
    switch (appearance) {
        case 'light':
            return 'light'
        case 'dark':
            return 'dark'
        default:
            return 'system'
    }
}

const themeModeToAppearance = (mode: ThemeMode): string => {
    switch (mode) {
        case 'light':
            return 'light'
        case 'dark':
            return 'dark'
        default:
            return 'auto'
    }
}

const loadAndApply = async (
    userUseCase: UserUseCase,
    setTheme: (mode: ThemeMode) => void
) => {
    const [config, err] = await userUseCase.loadUserConfig()
    if (err !== null || !config?.appearance) return
    setTheme(appearanceToThemeMode(config.appearance))
}

export { appearanceToThemeMode, themeModeToAppearance, loadAndApply }
