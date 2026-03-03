import type { GoAsync, UserProfile } from '@nao-todo/types'
import type { UserRepository } from './repositories'
import type { UserEntity } from './entities'

export class UserDomain {
    /**
     * 用户域服务
     * @param userRepo 用户存储库
     */
    constructor(private userRepo: UserRepository) {}

    /**
     * 更新用户昵称
     * @param newNickname 新昵称
     * @returns 更新结果
     */
    async updateNickname(newNickname: UserProfile['nickname']): GoAsync<void> {
        return await this.userRepo.updateNickname(newNickname)
    }

    /**
     * 获取用户个人信息
     * @returns 用户个人信息
     */
    async getProfile(): GoAsync<UserEntity> {
        return await this.userRepo.getProfile()
    }

    /**
     * 更新用户密码
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     * @returns 更新结果
     */
    async updatePassword(oldPassword: string, newPassword: string): GoAsync<void> {
        return await this.userRepo.updatePassword(oldPassword, newPassword)
    }
}
