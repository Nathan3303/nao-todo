import { unwrapError } from '@nao-todo/shared'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useAuthUseCase, useBuiltInProjectUseCase } from '@/hooks'
import { inject, provide, ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from './context'
import { useUserStore } from '@nao-todo/presentation/user'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'

/**
 * 日历视图上下文提供器
 * @description 提供日历视图上下文，包括日历视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const useCalendarView = () => {
    /**
     * 注入应用上下文
     */
    const {
        userUseCase,
        projectUseCase,
        tagUseCase,
        taskUseCase,
        appDialogManager,
        appSubscriber,
        isUseFloatAside,
        isDisplayAside,
        switchDisplayAside
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 注入认证使用案例上下文
     * @description 提供日历视图的认证使用案例上下文，用于认证相关的操作
     * @use AuthUseCase.create(useUserStore()) - 认证使用案例上下文
     * @use UserUseCase.create(useUserStore()) - 用户使用案例上下文
     */
    const authUseCase = useAuthUseCase(useUserStore())
    const builtInProjectUseCase = useBuiltInProjectUseCase(useBuiltInProjectsStore())

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
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside
    })

    /**
     * 返回日历视图上下文
     */
    return {
        init,
        isLoading,
        error
    }
}
