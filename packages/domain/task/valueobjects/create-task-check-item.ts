import type { Go } from '@nao-todo/types'

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
        if (!this.taskId) return '任务 ID不能为空'
        if (!this.name) return '检查事项内容不能为空'
        if (this.name.length > 64) return '检查事项内容最多 64 个字符'
        return null
    }
}

