import type { ComputedRef } from 'vue'
import type {
    TagViewObject,
    TaskViewObject,
    UserViewObject,
    TagPreferenceViewObject
} from '@nao-todo/types'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { TagHandler } from '@/infrastructure/handlers/tasks/tag-handler'

export type TagViewProps = {
    tagId?: string
    taskId?: string
}

export type TagViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    tag: ComputedRef<TagViewObject | undefined>
    preference: ComputedRef<TagPreferenceViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    tagHandler: TagHandler
    subscriber: Subscriber
    isHideCompletedAlready: ComputedRef<boolean>
    profile: ComputedRef<UserViewObject | undefined>
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    showTaskCreator: () => void
}
