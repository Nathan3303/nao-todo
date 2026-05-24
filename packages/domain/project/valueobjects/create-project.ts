import type { Go } from '@nao-todo/types'

/**
 * 创建任务清单值对象
 * @description 创建任务清单值对象，包含创建任务清单的属性
 */
export class CreateProjectValueObject {
    /**
     * 创建任务清单值对象构造函数
     * @param name 任务清单名称
     * @param icon 任务清单图标
     * @param description 任务清单描述
     */
    constructor(
        public name: string,
        public icon: string,
        public description: string
    ) {}

    /**
     * 验证创建任务清单值对象
     * @returns 验证结果
     */
    validate(): Go<void> {
        if (!this.name) return '任务清单名称不能为空'
        if (this.name.length > 64) return '任务清单名称最多64个字符'
        if (!this.icon) return '任务清单图标不能为空'
        if (this.icon.length > 32) return '任务清单图标最多32个字符'
        if (this.description && this.description.length > 256) return '任务清单描述最多256个字符'
        return null
    }
}
