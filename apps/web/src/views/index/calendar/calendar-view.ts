import { responsiveTypes, unwrapError, useAsideWidth, useResponsiveAside } from '@nao-todo/shared'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import {
    useBuiltInProjectUseCase,
    useProjectUseCase,
    useTagUseCase,
    useTaskCheckItemUseCase,
    useTaskCommentUseCase,
    useTaskUseCase
} from '@/hooks'
import { inject, provide, ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY, type CalendarTaskScope } from './context'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import {
    useTaskDetailsStore,
    useTasksStore,
    TASK_DETAILS_PRE_CONTEXT_KEY
} from '@nao-todo/presentation/task'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import {
    usePomodoroFocusStore,
    usePomodoroSessionStore,
    usePomodoroTimerStore
} from '@nao-todo/presentation/pomodoro'
import { storeToRefs } from 'pinia'
import { APP_CONTEXT_KEY } from '@/context'
import { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 日历视图上下文提供器
 * @description 提供日历视图上下文，包括日历视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等，
 *              并内嵌任务详情抽屉所需的预上下文（Q5-B：详情在日历区内打开）。
 */
export const useCalendarView = () => {
    // @viewContext 应用与首页上下文
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!
    const {
        appDialogManager,
        appSubscriber,
        isUseFloatAside,
        isDisplayAside,
        switchDisplayAside,
        getProjectName,
        showTaskDetails
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()
    const taskDetailsStore = useTaskDetailsStore()
    const pomodoroSessionStore = usePomodoroSessionStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    const pomodoroFocusStore = usePomodoroFocusStore()

    // @presetStates
    const { avaliableProjects } = storeToRefs(projectsStore)
    const { tags: avaliableTags } = storeToRefs(tagsStore)
    const { currentTaskId: pomodoroCurrentTaskId } = storeToRefs(pomodoroSessionStore)
    const { status: pomodoroTimerStatus } = storeToRefs(pomodoroTimerStore)
    const { status: pomodoroFocusStatus } = storeToRefs(pomodoroFocusStore)

    // @usecases 业务依赖在视图内由组合式组装（不来自父视图上下文）
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(tasksStore)
    const builtInProjectUseCase = useBuiltInProjectUseCase(useBuiltInProjectsStore())
    const taskCheckItemUseCase = useTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = useTaskCommentUseCase(taskDetailsStore)
    const subTaskUseCase = useTaskUseCase(taskDetailsStore)

    // @hook 详情抽屉右侧栏（与任务区同一套响应式组件，宽度独立记忆）
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'CALENDAR_OUTLINE_WIDTH'
    )

    // @states 任务筛选状态（侧边栏复选框与头部范围菜单同源）
    const selectedProjectIds = ref<string[]>([]) // 勾选的清单
    const selectedTagIds = ref<string[]>([]) // 勾选的标签
    const hideCompleted = ref<boolean>(false) // 隐藏已完成任务

    // @action 清除清单/标签两组筛选（不影响 hideCompleted）
    const clearFilter = () => {
        selectedProjectIds.value = []
        selectedTagIds.value = []
    }

    // @action 快捷设置单一范围（替换式）
    const applyScope = (scope: CalendarTaskScope) => {
        if (scope.type === 'project') {
            selectedProjectIds.value = [scope.id ?? '']
            selectedTagIds.value = []
        } else if (scope.type === 'tag') {
            selectedProjectIds.value = []
            selectedTagIds.value = [scope.id ?? '']
        } else {
            selectedProjectIds.value = []
            selectedTagIds.value = []
        }
    }

    // @method 选择任务并启动番茄钟计时器（详情抽屉复用）
    const selectTaskAndStartTimer = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroTimerStore.start()
    }

    // @method 选择任务并启动番茄钟专注（详情抽屉复用）
    const selectTaskAndStartFocus = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroFocusStore.start()
    }

    /**
     * 加载数据
     * @description 加载内置项目、项目和标签数据，并处理加载状态和错误信息
     */
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    const init = async () => {
        isLoading.value = true
        builtInProjectUseCase.loadBuiltInProjects()
        await Promise.allSettled([projectUseCase.loadProjects(), tagUseCase.loadTags()]).then(
            (results) => {
                isLoading.value = false
                results.forEach((result) => {
                    if (result.status !== 'rejected') return
                    error.value = unwrapError(result.reason)
                })
            }
        )
    }

    /**
     * 提供日历视图上下文
     */
    provide(CALENDAR_VIEW_CONTEXT_KEY, {
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        showTaskDetails,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter,
        applyScope
    })

    /**
     * 提供任务详情预上下文（Q5-B）
     * @description 与任务区同构：日历内容区直接复用 TaskDetailsAdapter 打开详情抽屉
     */
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

    /**
     * 返回日历视图上下文
     */
    return {
        init,
        isLoading,
        error
    }
}