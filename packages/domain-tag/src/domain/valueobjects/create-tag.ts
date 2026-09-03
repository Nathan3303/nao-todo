import type { Go } from '@nao-todo/shared'
import { TagEntity } from '../entities'

/**
 * 创建标签视图对象
 * @description 创建标签视图对象，用于创建标签实体
 */
export class CreateTagValueObject {
    // 创建标签视图对象构造函数
    constructor(
        public name: string, // 标签名称
        public description: string, // 标签描述
        public color: string, // 标签颜色
        public icon: string // 标签图标
    ) {}

    /**
     * 转换为标签实体
     * @returns 标签实体 或 错误
     */
    toEntity(): Go<TagEntity> {
        // 创建空标签实体
        const newTagEntity = TagEntity._createWithEmpty()
        // 更新标签图标
        const iconErr = newTagEntity.updateIcon(this.icon)
        if (iconErr !== null) {
            return [null, iconErr]
        }
        // 更新标签名称
        const nameErr = newTagEntity.updateName(this.name)
        if (nameErr !== null) {
            return [null, nameErr]
        }
        // 更新标签描述
        const descriptionErr = newTagEntity.updateDescription(this.description)
        if (descriptionErr !== null) {
            return [null, descriptionErr]
        }
        // 更新标签颜色
        const colorErr = newTagEntity.updateColor(this.color)
        if (colorErr !== null) {
            return [null, colorErr]
        }
        // 返回标签实体
        return [newTagEntity, null]
    }
}