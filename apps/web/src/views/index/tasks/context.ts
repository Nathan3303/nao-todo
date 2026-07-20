import type { BuiltInProjectUseCase } from '@nao-todo/application/built-in-project/usecases'
import type { ProjectHandler } from '@nao-todo/presentation/project'
import type { ProjectUseCase } from '@nao-todo/application/project/usecases'
import type { TagHandler } from '@nao-todo/presentation/tag'
import type { TagUseCase, TagViewObject } from '@nao-todo/application/tag/usecases'
import type { TaskHandler } from '@nao-todo/presentation/task'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/application/task/usecases'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 任务视图上下文
export type TasksViewContext = {
    builtInProjectUseCase: BuiltInProjectUseCase
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase

    appDialogManager: DialogManager
    appSubscriber: Subscriber

    projectHandler: ProjectHandler
    tagHandler: TagHandler
    taskHandler: TaskHandler

    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    handleResizeAside: (width: number) => void

    outlineWidth: Ref<string>
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    handleResizeOutline: (width: number) => void

    showTaskDetails: (taskId: TaskViewObject['id']) => void
    getProjectName: (projectId: string) => string
    getTagColor: (tagId: TagViewObject['id']) => string
    getColumnLabel: (key: string) => string
}

// 任务视图上下文注入键
export const TASKS_VIEW_CONTEXT_KEY: InjectionKey<TasksViewContext> = Symbol('TASKS_VIEW_CONTEXT')
