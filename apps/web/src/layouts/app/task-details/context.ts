import type { TaskCommentHandler } from '@/infrastructure/handlers/task-comment'
import type { TaskCheckItemHandler } from '@/infrastructure/handlers/task-check-item'
import type { TaskHandler } from '@/infrastructure/handlers/task'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { GoAsync } from '@nao-todo/types'
import { TaskDetailsEmits, TaskDetailsViewObject } from './types'
import { ProjectViewObject } from '@nao-todo/usecases/project'
import { TagViewObject } from '@nao-todo/usecases/tag'
import {
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    TaskUseCase,
    TaskViewObject
} from '@nao-todo/usecases/task'

// 任务详情上下文
export type TaskDetailsContext = {
    dialogManager: DialogManager

    emit: TaskDetailsEmits
    vo: Ref<TaskDetailsViewObject | null>

    projects: ComputedRef<ProjectViewObject[]>
    tags: Ref<TagViewObject[]>
    checkItems: ComputedRef<TaskCheckItemViewObject[]>
    comments: ComputedRef<TaskCommentViewObject[]>
    subTasks: ComputedRef<TaskViewObject[]>

    taskHandler: TaskHandler
    subTaskHandler: TaskHandler
    checkItemHandler: TaskCheckItemHandler
    commentHandler: TaskCommentHandler

    checkItemProgress: ComputedRef<{ percentage: number; text: string }>
    isCommenting: Ref<boolean>

    checkItemsLoading: Ref<boolean>
    checkItemsError: Ref<string>
    commentsLoading: Ref<boolean>
    commentsError: Ref<string>
    subTasksLoading: ComputedRef<boolean>
    subTasksError: ComputedRef<string>

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
}

// 任务详情上下文键
export const TASK_DETAILS_CONTEXT_KEY: InjectionKey<TaskDetailsContext> =
    Symbol('TASK_DETAILS_CONTEXT')

// 任务详情预上下文
export type TaskDetailsPreContext = {
    taskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    outlineWidth: Ref<string>
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    handleResizeOutline: (newWidth: number) => void

    getProjectName: (projectId: ProjectViewObject['id']) => ProjectViewObject['name']
}

// 任务详情预上下文键
export const TASK_DETAILS_PRE_CONTEXT_KEY: InjectionKey<TaskDetailsPreContext> = Symbol(
    'TASK_DETAILS_PRE_CONTEXT'
)

