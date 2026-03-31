import { Go } from '@nao-todo/types'

/**
 * 创建标签视图对象
 * @description 创建标签视图对象，用于创建标签实体
 */
export class CreateTagValueObject {
    /**
     * 创建标签视图对象构造函数
     * @param name 标签名称
     * @param color 标签颜色
     * @param icon 标签图标
     */
    constructor(
        public userId: string,
        public name: string,
        public description: string,
        public color: string,
        public icon: string
    ) {}

    /**
     * 验证创建标签视图对象
     * @returns 验证错误信息，若验证通过则返回 null
     */
    validate(): Go<void> {
        if (!this.name) return '标签名称不能为空'
        if (this.name.length > 64) return '标签名称最多64个字符'
        if (!this.color) return '标签颜色不能为空'
        if (this.color.length > 16) return '标签颜色最多16个字符'
        if (this.description && this.description.length > 256) return '标签描述最多256个字符'
        return null
    }
}
