import { APP_CONTEXT_KEY } from '@/context'
import {
    useBuiltInProjectUseCase,
    useProjectUseCase,
    useTagUseCase,
    useTaskCheckItemUseCase,
    useTaskCommentUseCase,
    useTaskUseCase
} from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import {
    usePomodoroFocusStore,
    usePomodoroSessionStore,
    usePomodoroTimerStore
} from '@nao-todo/presentation/pomodoro'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import {
    columnLabels,
    TASK_DETAILS_PRE_CONTEXT_KEY,
    useTaskDetailsStore,
    useTasksStore
} from '@nao-todo/presentation/task'
import { responsiveTypes, unwrapError, useAsideWidth, useResponsiveAside } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { inject, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { TASKS_VIEW_CONTEXT_KEY } from './context'
import { MULTI_SELECT_CONTEXT_KEY } from './multi-select-context'
import { TaskViewObject } from '@nao-todo/domain-task'
import { useRouter } from 'vue-router'

const useTasksView = () => {
    // @contexts
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!
    const { appSubscriber, appDialogManager, getProjectName, getTagColor, showTaskDetails } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const router = useRouter()
    const projectsStore = useProjectsStore()
    const tasksStore = useTasksStore()
    const taskDetailsStore = useTaskDetailsStore()
    const tagsStore = useTagsStore()
    const pomodoroSessionStore = usePomodoroSessionStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    const pomodoroFocusStore = usePomodoroFocusStore()

    // @usecase 业务依赖在此由组合式组装（DI 入口；不来自父视图上下文）
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(tasksStore)

    // @presetStates
    const { avaliableProjects } = storeToRefs(projectsStore)
    const { tags: avaliableTags } = storeToRefs(tagsStore)
    const { currentTaskId: pomodoroCurrentTaskId } = storeToRefs(pomodoroSessionStore)
    const { status: pomodoroTimerStatus } = storeToRefs(pomodoroTimerStore)
    const { status: pomodoroFocusStatus } = storeToRefs(pomodoroFocusStore)

    // @usecases
    const builtInProjectUseCase = useBuiltInProjectUseCase(useBuiltInProjectsStore())
    const taskCheckItemUseCase = useTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = useTaskCommentUseCase(taskDetailsStore)
    const subTaskUseCase = useTaskUseCase(taskDetailsStore)

    // @states&method 初始化处理程序
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    const init = async () => {
        isLoading.value = true
        builtInProjectUseCase.loadBuiltInProjects()
        await Promise.allSettled([projectUseCase.loadProjects(), tagUseCase.loadTags()]).then(
            (results) => {
                results.forEach((result) => {
                    if (result.status !== 'rejected') return
                    error.value = unwrapError(result.reason)
                })
            }
        )
        isLoading.value = false
    }

    // @hook 响应式边栏
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'TASKS_OUTLINE_WIDTH'
    )

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => {
        return (columnLabels.value as Record<string, string>)[key] || ''
    }

    /**
     * 选择任务并启动番茄钟计时器
     * @param taskId 任务 ID
     * @param name 任务名称
     */
    const selectTaskAndStartTimer = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroTimerStore.start()
    }

    /**
     * 选择任务并启动番茄钟专注
     * @param taskId 任务 ID
     * @param name 任务名称
     */
    const selectTaskAndStartFocus = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroFocusStore.start()
    }

    /**
     * 检测被删除的清单是否正在浏览，如果正在浏览则需要跳转至 “所有任务”
     * @param projectId 被删除的清单 ID
     */
    const resetViewWhenProjectDeleted = async (projectId: string) => {
        const currentProjectId = router.currentRoute.value.params.projectId
        const isSame = currentProjectId === projectId
        if (isSame) await router.replace('/tasks/all')
    }

    // @provide Tasks view context
    provide(TASKS_VIEW_CONTEXT_KEY, {
        appDialogManager,
        appSubscriber,
        outlineWidth,
        isDisplayOutline,
        isUseFloatOutline,
        handleResizeOutline,
        showTaskDetails,
        getProjectName,
        getTagColor,
        getColumnLabel
    })

    // @provide 多选编辑上下文
    const multiSelectIsOpen = ref<boolean>(false)
    const multiSelectSelectedIds = ref<TaskViewObject['id'][]>([])
    const multiSelectClearSignal = ref<number>(0)

    const openMultiSelectPanel = (payload: { selectedIds: TaskViewObject['id'][] }) => {
        multiSelectSelectedIds.value = payload.selectedIds
        multiSelectIsOpen.value = true
    }
    const closeMultiSelectPanel = () => {
        multiSelectIsOpen.value = false
    }
    const requestClearMultiSelect = () => {
        multiSelectClearSignal.value++
        multiSelectIsOpen.value = false
        multiSelectSelectedIds.value = []
    }
    provide(MULTI_SELECT_CONTEXT_KEY, {
        isOpen: multiSelectIsOpen,
        selectedIds: multiSelectSelectedIds,
        clearSignal: multiSelectClearSignal,
        openPanel: openMultiSelectPanel,
        closePanel: closeMultiSelectPanel,
        requestClear: requestClearMultiSelect
    })

    // @watch 路由变化时清空多选状态
    watch(
        () => router.currentRoute.value.fullPath,
        () => requestClearMultiSelect()
    )

    // @provide TaskDetailsPreContext
    provide(TASK_DETAILS_PRE_CONTEXT_KEY, {
        taskUseCase,
        taskCommentUseCase,
        taskCheckItemUseCase,
        subTaskUseCase,
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        avaliableProjects,
        avaliableTags,
        pomodoroCurrentTaskId,
        pomodoroTimerStatus,
        pomodoroFocusStatus,
        outlineWidth,
        isDisplayOutline,
        isUseFloatOutline,
        handleResizeOutline,
        getTag: tagsStore.getTag,
        getProjectName,
        selectTaskAndStartTimer,
        selectTaskAndStartFocus,
        resetTimer: () => pomodoroTimerStore.reset(),
        resetFocus: () => pomodoroFocusStore.reset()
    })

    // @mounted 组件挂载
    onMounted(async () => {
        await init()
        appSubscriber.subscribe('project:deleted', resetViewWhenProjectDeleted)
    })

    // @unmounted 组件卸载
    onUnmounted(() => {
        appSubscriber.unsubscribe('project:deleted', resetViewWhenProjectDeleted)
    })

    // @returns
    return {
        isLoading,
        error,
        init,
        subscriber: appSubscriber
    }
}

export default useTasksView