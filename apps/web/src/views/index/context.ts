import type { AppAsideV2ControlOption } from '@/components/app/aside-v2'
import { UserUseCase } from '@nao-todo/domain-identity'
import { ProjectUseCase } from '@nao-todo/domain-project'
import { TagUseCase } from '@nao-todo/domain-tag'
import { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import type { ProjectHandler } from '@nao-todo/presentation/project'
import type { TagHandler } from '@nao-todo/presentation/tag'
import type { TaskHandler } from '@nao-todo/presentation/task'
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
    asideWidth: Ref<string>
    handleResizeAside: (newWidth: number) => void
    setControllOption: (newOption: AppAsideV2ControlOption) => void
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    // methods
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    getProjectName: ProjectHandler['getProjectName']
    getTagColor: TagHandler['getTagColor']
}

// 首页视图上下文注入键
export const INDEX_VIEW_CONTEXT_KEY: InjectionKey<IndexViewContext> = Symbol('INDEX_VIEW_CONTEXT')