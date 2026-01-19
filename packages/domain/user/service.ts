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
}
