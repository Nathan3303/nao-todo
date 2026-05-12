import type { AppContext } from '@/app'
import { APP_CONTEXT_KEY, INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { useThemeStore, useUserStore, type ThemeMode } from '@/stores'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { inject, provide, type Ref } from 'vue'

export type IndexViewContext = {
    appContext: AppContext
    userUseCase: UserUseCase
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
}

const useIndexView = () => {
    // @context App context
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @dataStore
    const userStore = useUserStore()
    const themeStore = useThemeStore()

    // @usecase User use case
    const userUseCase = UserUseCase.create(userStore)

    // @hook 边栏响应式状态
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    // @method 从用户配置加载主题模式并应用到主题存储
    const loadUserThemeModeFromConfig = () => {
        themeStore.updateTheme(userStore.config?.appearance as ThemeMode | 'system')
    }

    // @provide Index view context
    provide<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY, {
        appContext,
        userUseCase,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        isDisplayOutline,
        isUseFloatOutline
    })

    // @return
    return {
        appContext,
        userUseCase,
        loadUserThemeModeFromConfig
    }
}

export default useIndexView

