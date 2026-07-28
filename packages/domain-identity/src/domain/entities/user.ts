import { Entity, Go } from '@nao-todo/shared'
import dayjs from 'dayjs'

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
        public state: number, // 用户状态
        public deactivedAt: string, // 用户注销日期
        public lastRestoreAt: string // 用户最后一次恢复账户时间（用于计算是否出于注销冷却期）
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    // 是否是管理员
    get isAdmin(): boolean {
        return this.state === 1
    }

    // 是否是VIP
    get isVIP(): boolean {
        return this.state === 2
    }

    // 是否已注销（待注销）
    get isDeactived(): boolean {
        return !!this.deactivedAt && dayjs(this.deactivedAt).isValid()
    }

    // 是否出于注销冷却期
    get isInCooldown(): boolean {
        const restoreDay = dayjs(this.lastRestoreAt)
        if (!restoreDay.isValid()) return false
        return restoreDay.add(1, 'month').isAfter(dayjs())
    }

    /**
     * 更新用户昵称
     * @param newNickname 新用户昵称
     * @returns 错误信息
     */
    changeNickname(newNickname: string): Go<void> {
        if (!newNickname) {
            return '新昵称不能为空'
        }
        if (newNickname.length > 32) {
            return '新昵称长度不能超过32个字符'
        }
        return null
    }
}