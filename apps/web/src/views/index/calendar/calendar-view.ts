import { AuthUseCase } from '@nao-todo/application/web/usecases/auth'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { inject, type Ref, provide, ref } from 'vue'
import { APP_CONTEXT_KEY, CALENDAR_VIEW_CONTEXT_KEY, INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { AppContext } from '@/app'
import type { IndexViewContext } from '@/views/index/index-view'
import type { DialogManager } from '@/infrastructure/hooks/use-dialog-manager'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import {
    useBuiltInProjectsStore,
    useProjectsStore,
    useTagsStore,
    useTasksStore,
    useUserStore
} from '@/stores'
import useSubscriber from '@nao-todo/infrastructure/hooks/use-subscriber'
import { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'
import { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import { TagUseCase } from '@nao-todo/application/web/usecases/tag'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { unwrapError } from '@nao-todo/infrastructure/utils'

/**
 * 日历视图上下文
 */
export type CalendarViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
    taskUseCase: TaskUseCase
    dialogManager: DialogManager
    subscriber: Subscriber
    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    handleResizeAside: (newWidth: number) => void
}

/**
 * 日历视图上下文提供器
 * @description 提供日历视图上下文，包括日历视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const useCalendarView = () => {
    /**
     * 注入应用上下文
     */
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!
    const indexViewContext = inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 注入响应式侧边栏上下文
     * @description 提供日历视图的响应式侧边栏上下文
     * @use useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    const { visible: isDisplayAside, switchVisible: switchDisplayAside } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE
    )

    /**
     * 注入侧边栏宽度上下文
     * @description 提供日历视图的侧边栏宽度上下文
     * @use useAsideWidth(256, 'CALENDAR_ASIDE_WIDTH') - 侧边栏宽度上下文
     */
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        256,
        'CALENDAR_ASIDE_WIDTH'
    )

    /**
     * 注入认证使用案例上下文
     * @description 提供日历视图的认证使用案例上下文，用于认证相关的操作
     * @use AuthUseCase.create(useUserStore()) - 认证使用案例上下文
     * @use UserUseCase.create(useUserStore()) - 用户使用案例上下文
     */
    const authUseCase = AuthUseCase.create(useUserStore())
    const userUseCase = UserUseCase.create(useUserStore())
    const builtInProjectUseCase = BuiltInProjectUseCase.create(useBuiltInProjectsStore())
    const projectUseCase = ProjectUseCase.create(useProjectsStore())
    const tagUseCase = TagUseCase.create(useTagsStore())
    const taskUseCase = TaskUseCase.create(useTasksStore())

    /**
     * 注入订阅器上下文
     * @description 提供日历视图的订阅器上下文，用于订阅事件和更新状态
     * @use useSubscriber() - 订阅器上下文
     */
    const subscriber = useSubscriber()

    /**
     * 加载数据
     * @description 加载内置项目、项目和标签数据，并处理加载状态和错误信息
     * @use Promise.allSettled([...]) - 加载内置项目、项目和标签数据，并处理加载状态和错误信息
     */
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    // 初始化处理程序
    const init = () => {
        isLoading.value = true
        Promise.allSettled([
            builtInProjectUseCase.loadBuiltInProjects(),
            projectUseCase.loadProjects(),
            tagUseCase.loadTags()
        ]).then((results) => {
            isLoading.value = false
            results.forEach((result) => {
                if (result.status !== 'rejected') return
                error.value = unwrapError(result.reason)
            })
        })
    }

    /**
     * 提供日历视图上下文
     * @description 提供日历视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等上下文
     */
    provide<CalendarViewContext>(CALENDAR_VIEW_CONTEXT_KEY, {
        authUseCase,
        userUseCase,
        taskUseCase,
        dialogManager: indexViewContext.dialogManager,
        subscriber,
        asideWidth,
        isDisplayAside,
        isUseFloatAside: appContext.isUseFloatAside,
        switchDisplayAside,
        handleResizeAside
    })

    /**
     * 返回日历视图上下文
     */
    return {
        init,
        isLoading,
        error,
        isDisplayAside,
        switchDisplayAside,
        asideWidth,
        handleResizeAside
    }
}

