import type { ComputedRef } from 'vue'
import type {
    TagViewObject,
    TaskViewObject,
    UserViewObject,
    ProjectPreferenceViewObject,
    ProjectViewObject
} from '@nao-todo/types'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { ProjectHandler } from '@/infrastructure/handlers/tasks/project-handler'

export type ProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type ProjectViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    project: ComputedRef<ProjectViewObject | undefined>
    preference: ComputedRef<ProjectPreferenceViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    projectHandler: ProjectHandler
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
