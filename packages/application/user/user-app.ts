import { useUserDomain } from '@nao-todo/domain/user'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { Err, UpdateNicknameVO, UserProfileVO, WithNull } from '@nao-todo/types'
import { reactive, type Reactive } from 'vue'
import { userEntity2userProfileVO } from './converters'

export type UserAppStates = {
    profile: WithNull<UserProfileVO>
}

export interface UserApp {
    states: Reactive<UserAppStates>
    updateNickname: (updateNicknameVO: UpdateNicknameVO) => Promise<Err>
    getProfile: () => Promise<Err>
}

export default (): UserApp => {
    // @domain User Domain
    const userDomain = useUserDomain(useUserRepository(getRequesterImpl()))

    // @states
    const states = reactive<UserAppStates>({
        profile: null
    })

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
        states.profile = userEntity2userProfileVO(userEntity)
        // 3. 返回
        return null
    }

    return { states, updateNickname, getProfile }
}
