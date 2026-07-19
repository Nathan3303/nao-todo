import type {
    BuiltInProjectHandler,
    BuiltInProjectPreferenceViewObject,
    BuiltInProjectViewObject
} from '@nao-todo/domain/built-in-project'
import type { TagViewObject } from '@nao-todo/domain/tag'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain/task'
import type { UserViewObject } from '@nao-todo/domain/user'
import type { DialogManager, Subscriber, TaskColumnOptions } from '@nao-todo/shared'
import type { ComputedRef, InjectionKey } from 'vue'

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
