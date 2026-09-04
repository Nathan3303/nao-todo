import type { Go } from '@nao-todo/shared/types'
import { Entity } from '@nao-todo/shared/entity'

/**
 * 用户配置实体
 * @description 用户配置实体，包含用户配置信息
 */
export class UserConfigEntity extends Entity {
    // constructor 用户配置实体构造函数
    constructor(
        public id: string, // 用户ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public appearance: string // 外观设置值
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 更新外观设置值
     */
    changeAppearence(nv: string): Go<void> {
        if (!['light', 'dark', 'system'].includes(nv)) {
            return '无效的外观值'
        }
        this.appearance = nv
        return null
    }
}