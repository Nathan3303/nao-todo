import { ProjectHandler } from '@/infrastructure/handlers/project'
import { TagHandler } from '@/infrastructure/handlers/tag'
import { TaskHandler } from '@/infrastructure/handlers/task'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { BuiltInProjectUseCase } from '@nao-todo/usecases/built-in-project'
import { ProjectUseCase } from '@nao-todo/usecases/project'
import { TagUseCase, TagViewObject } from '@nao-todo/usecases/tag'
import { TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import { InjectionKey, Ref } from 'vue'

// 任务视图上下文
export type TasksViewContext = {
    builtInProjectUseCase: BuiltInProjectUseCase
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

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


