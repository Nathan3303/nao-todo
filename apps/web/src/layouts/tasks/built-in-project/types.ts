import type { ComputedRef } from 'vue'
import type {
    TagViewObject,
    TaskViewObject,
    BuiltInProjectPreferenceViewObject,
    BuiltInProjectViewObject,
    UserViewObject
} from '@nao-todo/types'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { BuiltInProjectLayoutHandlers } from '@/infrastructure/handlers/tasks/built-in-project-handler'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'

export type BuiltInProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type BuiltInProjectViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    builtInProject: ComputedRef<BuiltInProjectViewObject | undefined>
    preference: ComputedRef<BuiltInProjectPreferenceViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    builtInProjectHandlers: BuiltInProjectLayoutHandlers
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

