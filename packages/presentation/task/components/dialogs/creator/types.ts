import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { TaskUseCase, TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/domain-task'

// 任务创建器对话框属性
export type TaskCreatorDialogProps = {
    taskUseCase: TaskUseCase
    subscriber: Subscriber
    dialogManager: DialogManager
    avaliableTags: TaskTagViewObject[]
    avaliableProjects: TaskProjectViewObject[]
}