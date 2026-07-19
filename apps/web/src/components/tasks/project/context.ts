import type {
    ProjectHandler,
    ProjectPreferenceViewObject,
    ProjectUseCase,
    ProjectViewObject
} from '@nao-todo/domain/project'
import type { TagViewObject } from '@nao-todo/domain/tag'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain/task'
import type { UserViewObject } from '@nao-todo/domain/user'
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
