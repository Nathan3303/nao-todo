import { Go } from '@nao-todo/types'

/**
 * 更新检查事项值对象
 * @description 更新检查事项值对象
 */
export class UpdateEventValueObject {
    public name?: string // 检查事项名称
    public isDone?: boolean // 是否完成
    public sortId?: number // 排序 ID

    /**
     * 更新检查事项值对象
     * @param id 检查事项 ID
     */
    constructor(public id: string) {}

    /**
     * 验证检查事项值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (this.name && this.name.length > 128) return '检查事项名称最多 128 个字符'
        if (this.sortId && this.sortId < 0) return '排序 ID 不能小于 0'
        return null
    }
}
