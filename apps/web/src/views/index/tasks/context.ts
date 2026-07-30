import type { BuiltInProjectUseCase } from '@nao-todo/domain-built-in-project'
import { ProjectUseCase } from '@nao-todo/domain-project'
import { TagUseCase, TagViewObject } from '@nao-todo/domain-tag'
import { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import type { ProjectHandler, TagHandler, TaskHandler } from '@nao-todo/presentation'
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