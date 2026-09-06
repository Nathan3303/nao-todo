import type { DialogManager, Subscriber } from '@nao-todo/shared'
import { TagViewObject } from '@nao-todo/domain-tag'
import { TaskViewObject } from '@nao-todo/domain-task'
import type { InjectionKey, Ref } from 'vue'

// 任务视图上下文（仅 UI 状态/服务与方法；业务依赖由各消费组合式自行组装）
export type TasksViewContext = {
    appDialogManager: DialogManager
    appSubscriber: Subscriber

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