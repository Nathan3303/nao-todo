import { DialogManager } from '@nao-todo/shared/hooks'
import type { TaskUseCase } from '@nao-todo/domain-task'

// 任务提醒弹窗属性
export type TaskReminderDialogProps = {
    dialogManager: DialogManager
    taskUseCase: TaskUseCase
    /**
     * 打开任务详情
     * @description 由装配层注入（不在此引入 router）：点弹窗内任务名 / 点系统通知都经此跳转（AC9）
     */
    onOpenTask?: (taskId: string) => void
}