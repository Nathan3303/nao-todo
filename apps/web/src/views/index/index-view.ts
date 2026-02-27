import { APP_CONTEXT_KEY, INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useResponsiveAside from '@/infrastructure/hooks/tasks-view/use-responsive-aside'
import { useUserStore } from '@/stores'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { UserDomain } from '@nao-todo/domain/user'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { inject, provide, type Ref } from 'vue'
import type { AppContext } from '@/app'

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

    // @usecase User use case
    const userDomain = new UserDomain(useUserRepository(getRequesterImpl()))
    const userUseCase = new UserUseCase(userDomain, userStore)

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
        userUseCase
    }
}

export default useIndexView
