import { APP_CONTEXT_KEY } from '@/context'
import {
    useBuiltInProjectUseCase,
    useTaskCheckItemUseCase,
    useTaskCommentUseCase,
    useTaskUseCase
} from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useBuiltInProjectsStore } from '@nao-todo/domain/built-in-project'
import {
    usePomodoroFocusStore,
    usePomodoroRecordsStore,
    usePomodoroTimerStore
} from '@nao-todo/domain/pomodoro'
import { useProjectsStore } from '@nao-todo/domain/project'
import { useTagsStore } from '@nao-todo/domain/tag'
import {
    columnLabels,
    TASK_DETAILS_PRE_CONTEXT_KEY,
    useTaskDetailsStore
} from '@nao-todo/domain/task'
import { responsiveTypes, unwrapError, useAsideWidth, useResponsiveAside } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { inject, provide, ref } from 'vue'
import { TASKS_VIEW_CONTEXT_KEY } from './context'

const useTasksView = () => {
    // @context App 上下文
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!

    // @context Index 视图上下文
    const {
        projectUseCase,
        tagUseCase,
        taskUseCase,
        appSubscriber,
        appDialogManager,
        projectHandler,
        tagHandler,
        taskHandler,
        getProjectName,
        getTagColor,
        showTaskDetails
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const taskDetailsStore = useTaskDetailsStore()
    const tagsStore = useTagsStore()
    const pomodoroRecordsStore = usePomodoroRecordsStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    const pomodoroFocusStore = usePomodoroFocusStore()

    // @presets
    const { avaliableProjects } = storeToRefs(useProjectsStore())
    const { tags: avaliableTags } = storeToRefs(tagsStore)
    const { currentTaskId: pomodoroCurrentTaskId } = storeToRefs(pomodoroRecordsStore)
    const { status: pomodoroTimerStatus } = storeToRefs(pomodoroTimerStore)
    const { status: pomodoroFocusStatus } = storeToRefs(pomodoroFocusStore)

    // @usecase Built-in project use case
    const builtInProjectUseCase = useBuiltInProjectUseCase(useBuiltInProjectsStore())

    // @usecase 任务详情面板相关用例
    const taskCheckItemUseCase = useTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = useTaskCommentUseCase(taskDetailsStore)
    const subTaskUseCase = useTaskUseCase(taskDetailsStore)

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
        appDialogManager,
        appSubscriber,
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
        // ---
        taskUseCase,
        taskCommentUseCase,
        taskCheckItemUseCase,
        subTaskUseCase,
        // ---
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        // ---
        avaliableProjects,
        avaliableTags,
        pomodoroCurrentTaskId,
        pomodoroTimerStatus,
        pomodoroFocusStatus,
        // ---
        outlineWidth,
        isDisplayOutline,
        isUseFloatOutline,
        handleResizeOutline,
        getTag: tagsStore.getTag,
        getProjectName
    })

    // @returns
    return { isLoading, error, init }
}

export default useTasksView
