import { APP_CONTEXT_KEY } from '@/context'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { useBuiltInProjectsStore, useUserStore } from '@/stores'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { unwrapError } from '@nao-todo/infrastructure/utils'
import { newAuthUseCase } from '@nao-todo/usecases/auth'
import { newBuiltInProjectUseCase } from '@nao-todo/usecases/built-in-project'
import { inject, provide, ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from './context'

/**
 * 日历视图上下文提供器
 * @description 提供日历视图上下文，包括日历视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const useCalendarView = () => {
    /**
     * 注入应用上下文
     */
    const { responsiveFlag, isUseFloatAside } = inject(APP_CONTEXT_KEY)!
    const { userUseCase, projectUseCase, tagUseCase, taskUseCase, dialogManager, subscriber } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 注入响应式侧边栏上下文
     * @description 提供日历视图的响应式侧边栏上下文
     * @use useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    const { visible: isDisplayAside, switchVisible: switchDisplayAside } = useResponsiveAside(
        responsiveFlag,
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
    const authUseCase = newAuthUseCase(useUserStore())
    const builtInProjectUseCase = newBuiltInProjectUseCase(useBuiltInProjectsStore())

    /**
     * 加载数据
     * @description 加载内置项目、项目和标签数据，并处理加载状态和错误信息
     * @use Promise.allSettled([...]) - 加载内置项目、项目和标签数据，并处理加载状态和错误信息
     */
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    const init = () => {
        Promise.allSettled([
            () => (isLoading.value = true),
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
    provide(CALENDAR_VIEW_CONTEXT_KEY, {
        authUseCase,
        userUseCase,
        taskUseCase,
        dialogManager,
        subscriber,
        asideWidth,
        isDisplayAside,
        isUseFloatAside,
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

