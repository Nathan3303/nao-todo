import type { ProjectHandler, ProjectUseCase } from '@nao-todo/domain/project'
import type { TagHandler, TagUseCase } from '@nao-todo/domain/tag'
import type { TaskHandler, TaskUseCase, TaskViewObject } from '@nao-todo/domain/task'
import type { UserUseCase } from '@nao-todo/domain/user'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

/**
 * 首页视图上下文
 * @description 包含首页视图的所有上下文数据，包括应用上下文、用户使用案例、对话框管理器、
 *              项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
 */
export type IndexViewContext = {
    // usecases
    userUseCase: UserUseCase
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase
    // managers
    appDialogManager: DialogManager
    appSubscriber: Subscriber
    // handlers
    projectHandler: ProjectHandler
    tagHandler: TagHandler
    taskHandler: TaskHandler
    // responsive
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    // methods
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    getProjectName: ProjectHandler['getProjectName']
    getTagColor: TagHandler['getTagColor']
}

// 首页视图上下文注入键
export const INDEX_VIEW_CONTEXT_KEY: InjectionKey<IndexViewContext> = Symbol('INDEX_VIEW_CONTEXT')
