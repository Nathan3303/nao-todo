import type { ComputedRef } from 'vue'
import type { Tag, Task, UserProfile, TagPreference } from '@nao-todo/types'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { TagHandler } from '@/handlers/tasks/tag-handler'

export type TagViewProps = {
    tagId?: string
    taskId?: string
}

export type TagViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    tag: ComputedRef<Tag | undefined>
    preference: ComputedRef<TagPreference | undefined>
    tags: ComputedRef<Tag[]>
    tagHandler: TagHandler
    subscriber: Subscriber
    isHideCompletedAlready: ComputedRef<boolean>
    profile: ComputedRef<UserProfile | undefined>
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: Task['id']) => void
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    showTaskCreator: () => void
}
