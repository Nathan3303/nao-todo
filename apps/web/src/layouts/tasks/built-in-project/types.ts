import type { ComputedRef } from 'vue'
import type {
    Tag,
    Task,
    BuiltInProjectPreference,
    BuiltInProject,
    UserProfile
} from '@nao-todo/types'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { BuiltInProjectLayoutHandlers } from '@/handlers/tasks/built-in-project-handler'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'

export type BuiltInProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type BuiltInProjectViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    builtInProject: ComputedRef<BuiltInProject | undefined>
    preference: ComputedRef<BuiltInProjectPreference | undefined>
    tags: ComputedRef<Tag[]>
    builtInProjectHandlers: BuiltInProjectLayoutHandlers
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
