import type { Go } from '@nao-todo/types'

/**
 * 更新任务清单值对象
 * @description 更新任务清单值对象，包含任务清单的名称、图标、描述
 */
export class UpdateProjectValueObject {
    public name?: string // 任务清单名称
    public icon?: string // 任务清单图标
    public description?: string // 任务清单描述
    public sortId?: number // 排序 ID

    /**
     * 更新任务清单值对象构造函数
     * @param id 任务清单ID
     */
    constructor(public id: string) {}

    /**
     * 验证更新任务清单值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (this.name && this.name.length > 64) return '任务清单名称最多64个字符'
        if (this.icon && this.icon.length > 32) return '任务清单图标最多32个字符'
        if (this.description && this.description.length > 256) return '任务清单描述最多256个字符'
        if (this.sortId && this.sortId <= 0) return '排序 ID 不能小于等于 0'
        return null
    }
}
