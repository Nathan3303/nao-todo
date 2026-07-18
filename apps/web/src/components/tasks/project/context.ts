import type { ComputedRef, InjectionKey } from 'vue'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { TaskColumnOptions, TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import type { ProjectHandler } from '@/infrastructure/handlers/project'
import {
    ProjectPreferenceViewObject,
    ProjectUseCase,
    ProjectViewObject
} from '@nao-todo/usecases/project'
import { TagViewObject } from '@nao-todo/usecases/tag'
import { UserViewObject } from '@nao-todo/usecases/user'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'

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

