import type { ComputedRef, InjectionKey } from 'vue'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { TaskColumnOptions, TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import {
    BuiltInProjectPreferenceViewObject,
    BuiltInProjectViewObject
} from '@nao-todo/usecases/built-in-project'
import { TagViewObject } from '@nao-todo/usecases/tag'
import { BuiltInProjectHandler } from '@/infrastructure/handlers/built-in-project'
import { UserViewObject } from '@nao-todo/usecases/user'

// BuiltInProject 视图上下文
export type BuiltInProjectViewContext = {
    taskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    builtInProjectHandlers: BuiltInProjectHandler

    builtInProject: ComputedRef<BuiltInProjectViewObject | undefined>
    preference: ComputedRef<BuiltInProjectPreferenceViewObject | undefined>
    profile: ComputedRef<UserViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    isHideCompletedAlready: ComputedRef<boolean>

    getColumnLabel: (key: keyof TaskColumnOptions) => string
    getProjectName: (projectId: string) => string

    showTaskDetails: (taskId: TaskViewObject['id']) => void
    showTaskCreator: () => void

    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
}

// BuiltInProject 视图上下文键
export const BUILT_IN_PROJECT_VIEW_CONTEXT_KEY: InjectionKey<BuiltInProjectViewContext> = Symbol(
    'BUILT_IN_PROJECT_VIEW_CONTEXT'
)


