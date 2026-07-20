import { DialogManager } from '@nao-todo/shared'
import { TaskUseCase } from '../../../usecases'

// 任务提醒弹窗属性
export type TaskReminderDialogProps = {
    dialogManager: DialogManager
    taskUseCase: TaskUseCase
}
