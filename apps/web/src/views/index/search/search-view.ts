import { responsiveTypes, unwrapError, useAsideWidth, useResponsiveAside } from '@nao-todo/shared'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import {
    useProjectUseCase,
    useTagUseCase,
    useTaskCheckItemUseCase,
    useTaskCommentUseCase,
    useTaskUseCase
} from '@/hooks'
import { inject, onMounted, provide, ref } from 'vue'
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
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 搜索视图上下文提供器
 * @description 搜索页不显示全局左栏；内嵌任务详情抽屉所需的预上下文（与日历同构），
 *              业务用例在视图内由组合式组装（不来自父视图上下文）。
 */
export const useSearchView = () => {
    // @viewContext 应用与首页上下文
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!
    const {
        appDialogManager,
        appSubscriber,
        isUseFloatAside,
        isDisplayAside,
        switchDisplayAside,
        getProjectName
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

    // @usecases 业务依赖在视图内由组合式组装
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(tasksStore)
    const taskCheckItemUseCase = useTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = useTaskCommentUseCase(taskDetailsStore)
    const subTaskUseCase = useTaskUseCase(taskDetailsStore)

    // @hook 详情抽屉右侧栏（与日历同构；宽度独立记忆）
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'SEARCH_OUTLINE_WIDTH'
    )

    // @mounted 搜索页无左栏：浮动模式不受影响；非浮动则隐藏全局左栏
    onMounted(() => {
        if (isUseFloatAside.value) return
        isDisplayAside.value = false
    })

    // @method 选择任务并启动番茄钟计时器（详情抽屉复用）
    const selectTaskAndStartTimer = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroTimerStore.start()
    }
    const selectTaskAndStartFocus = (
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ) => {
        pomodoroSessionStore.selectTask(taskId, name)
        pomodoroFocusStore.start()
    }

    // @states 项目/标签加载（行 meta 依赖；错误给整页重试入口）
    const isLoading = ref<boolean>(true)
    const error = ref<string>('')
    const init = async () => {
        isLoading.value = true
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
     * 提供任务详情预上下文（与日历/任务区同构）
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

    // @returns
    return {
        init,
        isLoading,
        error,
        switchDisplayAside,
        isUseFloatAside,
        isDisplayAside
    }
}