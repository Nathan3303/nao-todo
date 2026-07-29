import { Entity, Go } from '@nao-todo/shared'

/**
 * 标签实体
 * @description 标签实体类，用于表示标签的属性和操作
 */
export class TagEntity extends Entity {
    // constructor 标签实体构造函数
    constructor(
        public id: string, // 标签ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        // public userId: string, // 用户ID
        public icon: string, // 标签图标
        public name: string, // 标签名称
        public description: string, // 标签描述
        public color: string, // 标签颜色
        public sortId: number // 排序ID
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 创建空标签实体
     * @returns 空标签实体
     */
    static _createWithEmpty(): TagEntity {
        return new TagEntity(
            '',
            new Date().toISOString(),
            new Date().toISOString(),
            null,
            '',
            '',
            '',
            '',
            1
        )
    }

    /**
     * 更新标签图标
     * @param newIcon 新图标
     * @returns 更新结果
     */
    updateIcon(newIcon: string): Go {
        if (!newIcon || newIcon.length > 16) {
            return new Error('New tag icon is invalid')
        }
        this.icon = newIcon
        return null
    }

    /**
     * 更新标签名称
     * @param newName 新名称
     * @returns 更新结果
     */
    updateName(newName: string): Go {
        if (!newName || newName.length > 32) {
            return new Error('New tag name is invalid')
        }
        this.name = newName
        return null
    }

    /**
     * 更新标签描述
     * @param newDescription 新描述
     * @returns 更新结果
     */
    updateDescription(newDescription: string): Go {
        if (newDescription.length > 256) {
            return new Error('New tag description is invalid')
        }
        this.description = newDescription
        return null
    }

    /**
     * 更新标签颜色
     * @param newColor 新颜色
     * @returns 更新结果
     */
    updateColor(newColor: string): Go {
        if (newColor.length > 16) {
            return new Error('New tag color is invalid')
        }
        this.color = newColor ?? 'transparent'
        return null
    }

    /**
     * 更新标签排序ID
     * @param newSortId 新排序ID
     * @returns 更新结果
     */
    updateSortId(newSortId: number): Go {
        if (newSortId <= 0) {
            return new Error('New tag sortId is invalid')
        }
        this.sortId = newSortId
        return null
    }
}