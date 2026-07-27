import type {
    ProjectPreferenceViewObject,
    ProjectUseCase,
    ProjectViewObject,
    TaskViewObject
} from '@nao-todo/application/'
import type { TagViewObject } from '@nao-todo/application/tag/viewobjects'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'
import type { UserViewObject } from '@nao-todo/application/user/viewobjects'
import type { ProjectHandler } from '@nao-todo/presentation/project'
import type { DialogManager, Subscriber, TaskColumnOptions } from '@nao-todo/shared'
import type { ComputedRef, InjectionKey } from 'vue'

// 项目视图上下文类型
export type ProjectViewContext = {
    taskUseCase: TaskUseCase
    projectUseCase: ProjectUseCase

    subscriber: Subscriber
    dialogManager: DialogManager

    projectHandler: ProjectHandler

    project: ComputedRef<ProjectViewObject | undefined>
    preference: ComputedRef<ProjectPreferenceViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    profile: ComputedRef<UserViewObject | undefined>
    isHideCompletedAlready: ComputedRef<boolean>

    showTaskDetails: (taskId: TaskViewObject['id']) => void
    showTaskCreator: () => void
    getColumnLabel: (key: keyof TaskColumnOptions) => string
    getProjectName: (projectId: string) => string
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
}

// 项目视图上下文注入键
export const PROJECT_VIEW_CONTEXT_KEY: InjectionKey<ProjectViewContext> =
    Symbol('PROJECT_VIEW_CONTEXT')