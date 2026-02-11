import type { ComputedRef } from 'vue'
import type { Tag, Task, UserProfile, ProjectPreference, Project } from '@nao-todo/types'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { ProjectHandler } from '@/handlers/tasks/project-handler'

export type ProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type ProjectViewContext = {
    tasksViewContext: TasksViewContext
    taskUseCase: TaskUseCase
    project: ComputedRef<Project | undefined>
    preference: ComputedRef<ProjectPreference | undefined>
    tags: ComputedRef<Tag[]>
    projectHandler: ProjectHandler
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
