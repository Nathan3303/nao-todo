import type { GoAsync, UserProfile } from '@nao-todo/types'
import { UserDomain } from '@nao-todo/domain/user'
import { userEntity2UserProfile } from '../converters/user'

interface UserStore {
    setUserProfile: (userProfile: UserProfile) => void
    updateUserProfile: (updateUserProfile: Partial<UserProfile>) => void
}

export class UserUseCase {
    /**
     * 用户用例
     * @param userDomain 用户领域模型
     * @param userStore 用户存储
     */
    constructor(
        private userDomain: UserDomain,
        private userStore: UserStore
    ) {}

    /**
     * 加载用户信息
     * @returns 用户信息
     */
    async loadUserProfile(): GoAsync<UserProfile> {
        // 1. 获取用户信息
        const [userEntity, err] = await this.userDomain.getProfile()
        // 2. 判断结果
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为VO
        const userProfile = userEntity2UserProfile(userEntity)
        // 3. 存储用户信息
        this.userStore.setUserProfile(userProfile)
        // 4. 返回
        return [userProfile, null]
    }

    /**
     * 更新用户昵称
     * @param newNickname 新昵称
     * @returns 更新结果
     */
    async updateNickname(newNickname: string): GoAsync<void> {
        // 1. 更新用户昵称
        const err = await this.userDomain.updateNickname(newNickname)
        // 2. 判断结果
        if (err !== null) {
            return err
        }
        // 3. 更新用户存储
        this.userStore.updateUserProfile({ nickname: newNickname })
        // 4. 返回
        return null
    }
}
