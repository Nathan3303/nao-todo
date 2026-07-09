import { ProjectHandler } from '@/infrastructure/handlers/project-handler'
import { TagHandler } from '@/infrastructure/handlers/tag-handler'
import { TaskHandler } from '@/infrastructure/handlers/task'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { ProjectUseCase } from '@nao-todo/usecases/project'
import { TagUseCase } from '@nao-todo/usecases/tag'
import { TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import { UserUseCase } from '@nao-todo/usecases/user'
import { InjectionKey, Ref } from 'vue'

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
    dialogManager: DialogManager
    subscriber: Subscriber
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

