import { Go } from '@nao-todo/types'

/**
 * 更新标签视图对象
 * @description 更新标签视图对象，用于更新标签实体
 */
export class UpdateTagValueObject {
    public name?: string // 标签名称
    public description?: string // 标签描述
    public color?: string // 标签颜色
    public icon?: string // 标签图标

    /**
     * 更新标签视图对象构造函数
     * @param id 标签ID
     */
    constructor(public id: string) {}

    /**
     * 验证更新标签视图对象
     * @returns 验证错误信息，若验证通过则返回 null
     */
    validate(): Go<void> {
        if (this.name && this.name.length > 64) return '标签名称最多64个字符'
        if (this.description && this.description.length > 256) return '标签描述最多256个字符'
        if (this.color && this.color.length > 16) return '标签颜色最多16个字符'
        if (this.icon && this.icon.length > 16) return '标签图标最多16个字符'
        return null
    }
}
