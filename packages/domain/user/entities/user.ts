import { Entity } from '../../shares/entity'

/**
 * 用户实体
 * @description 用户实体，包含用户的基本信息和状态
 */
export class UserEntity extends Entity {
    // constructor 用户实体构造函数
    constructor(
        public id: string, // 用户ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public email: string, // 用户邮箱
        public nickname: string, // 用户昵称
        public avatar: string, // 用户头像
        public createdFrom: string, // 注册源
        public role: string, // 用户角色
        public state: number // 用户状态
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * isAdmin 是否是管理员
     */
    isAdmin(): boolean {
        return this.state === 1
    }

    /**
     * isVIP 是否是VIP
     */
    isVIP(): boolean {
        return this.state === 2
    }
}

