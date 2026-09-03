import type { Go } from '@nao-todo/shared'
import { CHECK_ITEM_NAME_MAX_LENGTH } from '../constants'
import { TaskErrorCode } from '../errors'

/**
 * CreateTaskCheckItemValueObject 创建任务检查项值对象
 * @description 创建任务检查项值对象，定义了任务检查项的属性
 */
export class CreateTaskCheckItemValueObject {
    /**
     * 创建检查事项值对象
     * @param taskId 任务 ID
     * @param name 检查事项名称
     * @param isDone 是否完成
     * @param isTopUp 是否置顶
     */
    constructor(
        public taskId: string,
        public name: string,
        public isDone: boolean,
        public isTopUp: boolean
    ) {}

    /**
     * 验证任务检查项值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (!this.taskId) return TaskErrorCode.TASK_ID_EMPTY
        if (!this.name) return TaskErrorCode.CHECK_ITEM_NAME_EMPTY
        if (this.name.length > CHECK_ITEM_NAME_MAX_LENGTH)
            return TaskErrorCode.CHECK_ITEM_NAME_TOO_LONG
        return null
    }
}