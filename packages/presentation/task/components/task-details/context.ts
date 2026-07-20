import type { DialogManager, GoAsync, Subscriber } from '@nao-todo/shared'
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
} from '@nao-todo/application'
import type { TaskDetailsViewObject } from './types'

// 任务详情上下文
export type TaskDetailsContext = {
    dialogManager: DialogManager

    vo: Ref<TaskDetailsViewObject | null>

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
    pomodoroCurrentTaskId: ComputedRef<TaskViewObject['id'] | null>
    pomodoroTimerStatus: ComputedRef<'running' | 'paused'>
    pomodoroFocusStatus: ComputedRef<'idle' | 'running' | 'paused'>

    checkItemsLoading: Ref<boolean>
    checkItemsError: Ref<string>
    commentsLoading: Ref<boolean>
    commentsError: Ref<string>
    subTasksLoading: ComputedRef<boolean>
    subTasksError: ComputedRef<string>

    updateTaskDetails: (id: TaskViewObject['id'], updateVO: UpdateTaskViewObject) => Promise<void>
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

    resortCheckItems: (
        oldEid: TaskCheckItemViewObject['id'],
        newEid: TaskCheckItemViewObject['id'],
        isUp: boolean
    ) => void
    makeCheckItemToTask: (checkItemId: TaskCheckItemViewObject['id']) => void

    selectTaskAndStartTimer: (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => void
    selectTaskAndStartFocus: (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => void
    resetTimer: () => void
    resetFocus: () => void
}

// 任务详情上下文键
export const TASK_DETAILS_CONTEXT_KEY: InjectionKey<TaskDetailsContext> =
    Symbol('TASK_DETAILS_CONTEXT')

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
    pomodoroCurrentTaskId: ComputedRef<TaskViewObject['id'] | null>
    pomodoroTimerStatus: ComputedRef<'running' | 'paused'>
    pomodoroFocusStatus: ComputedRef<'idle' | 'running' | 'paused'>

    outlineWidth: Ref<string>
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    handleResizeOutline: (newWidth: number) => void

    getTag: (tagId: TaskTagViewObject['id']) => TaskTagViewObject | undefined
    getProjectName: (projectId: TaskProjectViewObject['id']) => TaskProjectViewObject['name']
}

// 任务详情预上下文键
export const TASK_DETAILS_PRE_CONTEXT_KEY: InjectionKey<TaskDetailsPreContext> = Symbol(
    'TASK_DETAILS_PRE_CONTEXT'
)
