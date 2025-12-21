import { useUserDomain } from '@nao-todo/domain/user'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { Err, UpdateNicknameVO, UserProfileVO, WithNull } from '@nao-todo/types'
import { ref, type Ref } from 'vue'
import { userEntity2userProfileVO } from './converters'

export interface UserApp {
    userProfile: Ref<WithNull<UserProfileVO>>
    updateNickname: (updateNicknameVO: UpdateNicknameVO) => Promise<Err>
    getProfile: () => Promise<Err>
}

export default (): UserApp => {
    // @domain User Domain
    const userDomain = useUserDomain(useUserRepository(getRequesterImpl()))

    // @state 用户 Profile
    const userProfile = ref<WithNull<UserProfileVO>>(null)

    // @method 更新用户昵称
    const updateNickname = async (updateNicknameVO: UpdateNicknameVO): Promise<Err> => {
        // 1. 检查属性值
        if (updateNicknameVO.nickname === '') return '昵称不能为空'
        // 2. 调用域服务
        const err = await userDomain.updateNickname(updateNicknameVO.nickname)
        if (err) return err
        // 3. 返回
        return null
    }

    // @method 获取用户信息
    const getProfile = async (): Promise<Err> => {
        // 1. 调用域服务
        const [userEntity, err] = await userDomain.getProfile()
        if (err) return err
        // 2. 更新状态
        userProfile.value = userEntity2userProfileVO(userEntity)
        // 3. 返回
        return null
    }

    return { userProfile, updateNickname, getProfile }
}
