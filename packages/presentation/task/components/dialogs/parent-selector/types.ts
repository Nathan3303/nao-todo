import type { DialogManager } from '@nao-todo/shared'
import type { TaskUseCase } from '@nao-todo/domain-task/usecases'
import type { TaskViewObject } from '@nao-todo/domain-task/viewobjects'

export type TaskParentSelectorDialogProps = {
    dialogManager: DialogManager
    taskUseCase: TaskUseCase
}

/**
 * 父任务选择器 payload
 * @param currentTaskId 当前任务 ID（从候选列表中排除）
 * @param onSelect 选择确认回调，返回所选父任务 ID
 */
export type ParentTaskSelectorPayload = {
    currentTaskId: TaskViewObject['id']
    onSelect: (parentTaskId: TaskViewObject['id']) => void
}
