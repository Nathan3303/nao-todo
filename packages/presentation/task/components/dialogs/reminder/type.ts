import { DialogManager } from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'

// 任务提醒弹窗属性
export type TaskReminderDialogProps = {
    dialogManager: DialogManager
    taskUseCase: TaskUseCase
}
