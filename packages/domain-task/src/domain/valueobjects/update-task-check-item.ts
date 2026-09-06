import type { Go } from '@nao-todo/shared/types'
import { CHECK_ITEM_NAME_MAX_LENGTH } from '../constants'
import { TaskErrorCode } from '../errors'

/**
 * UpdateTaskCheckItemValueObject 更新任务检查项值对象
 * @description 更新任务检查项值对象，定义了任务检查项的属性
 */
export class UpdateTaskCheckItemValueObject {
    public name?: string // 检查事项名称
    public isDone?: boolean // 是否完成
    public sortId?: number // 排序 ID

    /**
     * 更新任务检查项值对象
     * @param id 任务检查项 ID
     */
    constructor(public id: string) {}

    /**
     * 验证任务检查项值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (this.name && this.name.length > CHECK_ITEM_NAME_MAX_LENGTH)
            return TaskErrorCode.CHECK_ITEM_NAME_TOO_LONG
        if (this.sortId && this.sortId < 0) return TaskErrorCode.CHECK_ITEM_SORT_ID_NEGATIVE
        return null
    }
}