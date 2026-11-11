import type { DialogManager, GoAsync, GoError, Subscriber } from '@nao-todo/shared'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { TaskCheckItemHandler, TaskCommentHandler, TaskHandler } from '../../handlers'
import type {
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    TaskProjectViewObject,
    TaskTagViewObject,
    TaskViewObject,
    UpdateTaskViewObject,
    TaskCheckItemUseCase,
    TaskCommentUseCase,
    TaskUseCase
} from '@nao-todo/domain-task'
import type { TaskDetailsViewObject } from './types'

// 任务详情上下文
export type TaskDetailsContext = {
    dialogManager: DialogManager

    vo: Ref<TaskDetailsViewObject | null>
    refreshKey: Ref<number>

    projects: ComputedRef<TaskProjectViewObject[]>
    tags: Ref<TaskTagViewObject[]>
    checkItems: ComputedRef<TaskCheckItemViewObject[]>
    comments: ComputedRef<TaskCommentViewObject[]>
    subTasks: ComputedRef<TaskViewObject[]>

    taskHandler: TaskHandler
    subTaskHandler: TaskHandler
    checkItemHandler: TaskCheckItemHandler
    commentHandler: TaskCommentHandler

    checkItemProgress: ComputedRef<{ percentage: number; text: string }>
    subTaskProgress: ComputedRef<{ percentage: number; text: string }>
    isCommenting: Ref<boolean>

    pomodoroCurrentTaskId: TaskDetailsPreContext['pomodoroCurrentTaskId']
    pomodoroTimerStatus: TaskDetailsPreContext['pomodoroTimerStatus']
    pomodoroFocusStatus: TaskDetailsPreContext['pomodoroFocusStatus']

    checkItemsLoading: Ref<boolean>
    checkItemsError: Ref<string>
    commentsLoading: Ref<boolean>
    commentsError: Ref<string>
    subTasksLoading: ComputedRef<boolean>
    subTasksError: ComputedRef<string>
    /** 原地刷新失败（**非阻塞**，`DEF-149`）：`null` = 无失败；`''` = 失败但无可读原因（两态编码） */
    subTasksRefreshError: ComputedRef<string | null>

    /**
     * 冻结某字段的编辑基准（`DEF-153`）：在控件**交互起点**调用（下拉/日期面板打开、标签编辑态进入、
     * 开关点击前）。保存时只为本次载荷涉及的字段透传 `O`。⛔ 不得传 store 当前值以外的东西。
     */
    beginEdit: (field: string) => void
    updateTaskDetails: (
        id: TaskViewObject['id'],
        updateVO: UpdateTaskViewObject
    ) => Promise<GoError>
    deleteTask: (id: TaskViewObject['id']) => Promise<void>
    restoreTask: (id: TaskViewObject['id']) => Promise<void>
    giveUpTask: (id: TaskViewObject['id']) => Promise<void>
    ungiveUpTask: (id: TaskViewObject['id']) => Promise<void>

    switchTaskDetails: (taskId: TaskViewObject['id']) => void
    closeDetails: () => void

    retryCheckItems: () => Promise<void>
    retryComments: () => Promise<void>
    retrySubTasks: () => Promise<void>
    createSubTask: (name: TaskViewObject['name']) => GoAsync<void>
    detachSubTask: (subTaskId: TaskViewObject['id']) => GoAsync<void>
    resortSubTasks: (
        originalId: TaskViewObject['id'],
        boundId: TaskViewObject['id'],
        isBefore: boolean
    ) => GoAsync<void>

    resortCheckItems: (
        oldEid: TaskCheckItemViewObject['id'],
        newEid: TaskCheckItemViewObject['id'],
        isUp: boolean
    ) => void
    makeCheckItemToTask: (checkItemId: TaskCheckItemViewObject['id']) => void

    selectTaskAndStartTimer: TaskDetailsPreContext['selectTaskAndStartTimer']
    selectTaskAndStartFocus: TaskDetailsPreContext['selectTaskAndStartFocus']
    resetTimer: TaskDetailsPreContext['resetTimer']
    resetFocus: TaskDetailsPreContext['resetFocus']
}

// 任务详情上下文键
export const TASK_DETAILS_CONTEXT_KEY: InjectionKey<TaskDetailsContext> =
    Symbol('TASK_DETAILS_CONTEXT')

/** 一条变更历史（**面向展示的最小形状**；⛔ 不含内部元字段，`T697` Q2 冻结契约） */
export interface TaskHistoryItem {
    /** 插入序 = 分页游标（keyset，⛔ 不用 offset） */
    seq?: number
    /** 变更发生的本机时间（ISO） */
    at: string
    /** 来源四值（`local-edit` / `pull` / `push-merge` / `conflict-retry`）→ UI 映射为中文 */
    source: 'local-edit' | 'pull' | 'push-merge' | 'conflict-retry'
    /** 动作六值 → UI 映射为中文 */
    action: 'create' | 'update' | 'archive' | 'unarchive' | 'delete' | 'restore'
    /** 字段级 diff（值 = 实体明文） */
    fields: Array<{ field: string; from: unknown; to: unknown }>
}

/** 一页变更历史 */
export interface TaskHistoryPage {
    /** 最新在前 */
    items: TaskHistoryItem[]
    /** 本页之外还有更早的记录 */
    hasMore: boolean
    /** 表不可用 / 老数据无历史 ⇒ 专门表示「不可用」（⛔ 不得用空数组冒充） */
    unavailable?: boolean
}

/**
 * 变更历史数据源（端侧经 DI 注入；`packages/presentation` 对 infrastructure **零 import**）
 * @description 实现见 `apps/web/src/hooks/use-task-history.ts`（web + desktop 共用 `app.ts` 一处 provide）；
 *              未 provide（如移动端 / 测试）⇒ 面板不渲染（不报错）。
 */
export interface TaskHistoryProvider {
    load: (taskId: string, beforeSeq?: number) => Promise<TaskHistoryPage>
}

// 变更历史上下文键（M5 / T704）
export const TASK_HISTORY_CONTEXT_KEY: InjectionKey<TaskHistoryProvider> =
    Symbol('TASK_HISTORY_CONTEXT')

// 任务详情预上下文
export type TaskDetailsPreContext = {
    taskUseCase: TaskUseCase
    taskCommentUseCase: TaskCommentUseCase
    taskCheckItemUseCase: TaskCheckItemUseCase
    subTaskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    avaliableProjects: ComputedRef<TaskProjectViewObject[]>
    avaliableTags: ComputedRef<TaskTagViewObject[]>
    pomodoroCurrentTaskId: Ref<TaskViewObject['id'] | null>
    pomodoroTimerStatus: Ref<'running' | 'paused'>
    pomodoroFocusStatus: Ref<'idle' | 'running' | 'paused'>

    outlineWidth: Ref<string>
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    handleResizeOutline: (newWidth: number) => void

    getTag: (tagId: TaskTagViewObject['id']) => TaskTagViewObject | undefined
    getProjectName: (projectId: TaskProjectViewObject['id']) => TaskProjectViewObject['name']
    selectTaskAndStartTimer: (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => void
    selectTaskAndStartFocus: (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => void
    resetTimer: () => void
    resetFocus: () => void
}

// 任务详情预上下文键
export const TASK_DETAILS_PRE_CONTEXT_KEY: InjectionKey<TaskDetailsPreContext> = Symbol(
    'TASK_DETAILS_PRE_CONTEXT'
)