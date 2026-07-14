import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { useBuiltInProjectsStore } from '@/stores'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { newBuiltInProjectUseCase } from '@nao-todo/usecases/built-in-project'
import { inject, provide, ref } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TASKS_VIEW_CONTEXT_KEY } from './context'
import { APP_CONTEXT_KEY } from '@/context'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from '@/layouts/app/task-details/context'

const useTasksView = () => {
    // @context App 上下文
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!

    // @context Index 视图上下文
    const {
        projectUseCase,
        tagUseCase,
        taskUseCase,
        subscriber,
        dialogManager,
        projectHandler,
        tagHandler,
        taskHandler,
        getProjectName,
        getTagColor,
        showTaskDetails
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @usecases
    const builtInProjectUseCase = newBuiltInProjectUseCase(useBuiltInProjectsStore())

    // @states&method 初始化处理程序
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    const init = () => {
        Promise.allSettled([
            () => (isLoading.value = true),
            builtInProjectUseCase.loadBuiltInProjects(),
            projectUseCase.loadProjects(),
            tagUseCase.loadTags()
        ])
            .then((results) => {
                results.forEach((result) => {
                    if (result.status !== 'rejected') return
                    error.value = unwrapError(result.reason)
                })
            })
            .finally(() => (isLoading.value = false))
    }

    // @hook 响应式边栏
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    // @hook 边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        256,
        'TASKS_ASIDE_WIDTH'
    )
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'TASKS_OUTLINE_WIDTH'
    )

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => {
        return (columnLabels.value as Record<string, string>)[key] || ''
    }

    // @provide Tasks view context
    provide(TASKS_VIEW_CONTEXT_KEY, {
        builtInProjectUseCase,
        projectUseCase,
        tagUseCase,
        taskUseCase,
        // ---
        dialogManager,
        subscriber,
        // ---
        projectHandler,
        tagHandler,
        taskHandler,
        // ---
        asideWidth,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        handleResizeAside,
        // ---
        outlineWidth,
        isDisplayOutline,
        isUseFloatOutline,
        handleResizeOutline,
        // ---
        showTaskDetails,
        getProjectName,
        getTagColor,
        getColumnLabel
    })

    // @provide TaskDetailsPreContext
    provide(TASK_DETAILS_PRE_CONTEXT_KEY, {
        isDisplayOutline,
        isUseFloatOutline,
        outlineWidth,
        handleResizeOutline,
        taskUseCase,
        subscriber,
        dialogManager,
        getProjectName
    })

    // @returns
    return { isLoading, error, init }
}

export default useTasksView

