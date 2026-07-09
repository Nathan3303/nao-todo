import { Entity } from '../../shares/entity'

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
}

