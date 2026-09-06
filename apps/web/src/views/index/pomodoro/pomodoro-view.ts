import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import {
    usePomodoroFocusStore,
    usePomodoroRecordsStore,
    usePomodoroSessionStore,
    usePomodorosStore,
    usePomodoroTimerStore
} from '@nao-todo/presentation/pomodoro'
import {
    TASK_DETAILS_PRE_CONTEXT_KEY,
    useTaskDetailsStore,
    useTasksStore
} from '@nao-todo/presentation/task'
import { responsiveTypes, useAsideWidth, useResponsiveAside } from '@nao-todo/shared'
import { inject, provide } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from './context'
import {
    usePomodoroUseCase,
    usePomodoroRecordUseCase,
    useTaskCheckItemUseCase,
    useTaskCommentUseCase,
    useTaskUseCase
} from '@/hooks'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 番茄钟视图上下文提供器
 * @description 提供番茄钟视图上下文，包括番茄钟视图的宽度、是否显示侧边栏、是否使用浮动侧边栏等
 */
export const usePomodoroView = () => {
    /**
     * 注入上下文
     * @inject APP_CONTEXT_KEY - 应用上下文
     * @inject INDEX_VIEW_CONTEXT_KEY - 主要视图上下文
     */
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!
    const {
        appDialogManager,
        appSubscriber,
        getProjectName,
        showTaskDetails,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside
    } = inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 常用番茄专注用例
     * @description 实例化常用番茄专注用例，注入常用番茄专注存储
     */
    const pomodoroUseCase = usePomodoroUseCase(usePomodorosStore())
    const pomodoroRecordUseCase = usePomodoroRecordUseCase(usePomodoroRecordsStore())

    // @stores
    const taskDetailsStore = useTaskDetailsStore()
    const tagsStore = useTagsStore()
    const pomodoroSessionStore = usePomodoroSessionStore()
    const pomodoroTimerStore = usePomodoroTimerStore()
    const pomodoroFocusStore = usePomodoroFocusStore()
    const { avaliableProjects } = storeToRefs(useProjectsStore())
    const { tags: avaliableTags } = storeToRefs(tagsStore)
    const { currentTaskId: pomodoroCurrentTaskId } = storeToRefs(pomodoroSessionStore)
    const { status: pomodoroTimerStatus } = storeToRefs(pomodoroTimerStore)
    const { status: pomodoroFocusStatus } = storeToRefs(pomodoroFocusStore)

    // @usecase 业务依赖在此由组合式组装（DI 入口；不来自父视图上下文）
    const taskUseCase = useTaskUseCase(useTasksStore())
    const taskCheckItemUseCase = useTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = useTaskCommentUseCase(taskDetailsStore)
    const subTaskUseCase = useTaskUseCase(taskDetailsStore)

    /**
     * 响应式侧边栏
     * @description 应用响应式侧栏 Hook，提供响应式侧边栏上下文
     * @use useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE) - 响应式侧边栏上下文
     */
    // const {
    //     visible: isDisplayAside,
    //     isFloating: isUseFloatAside,
    //     switchVisible: switchDisplayAside
    // } = useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE)

    /**
     * 响应式任务详情面板
     * @description 应用响应式侧栏 Hook，提供响应式任务详情面板上下文
     * @use useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE_TABLE) - 响应式任务详情面板上下文
     */
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    /**
     * 响应式侧边栏宽度
     * @description 应用响应式侧栏宽度 Hook，提供响应式侧边栏宽度上下文
     * @use useAsideWidth(320, 'POMODORO_ASIDE_WIDTH') - 响应式侧边栏宽度上下文
     */
    // const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
    //     320,
    //     'POMODORO_ASIDE_WIDTH'
    // )

    /**
     * 响应式任务详情面板宽度
     * @description 应用响应式侧栏宽度 Hook，提供响应式任务详情面板宽度上下文
     * @use useAsideWidth(480, 'POMODORO_OUTLINE_WIDTH') - 响应式任务详情面板宽度上下文
     */
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'POMODORO_OUTLINE_WIDTH'
    )

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
     * 提供番茄钟视图上下文
     */
    provide(POMODORO_VIEW_CONTEXT_KEY, {
        taskUseCase,
        pomodoroUseCase,
        pomodoroRecordUseCase,
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        getProjectName,
        showTaskDetails
    })

    /**
     * 提供任务详情适配器上下文
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
}