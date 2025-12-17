import { defineStore } from 'pinia'
import { useUserDomain } from '@nao-todo/domain/user'
import { useUserRepository } from '@nao-todo/infrastructure/backend/user/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { Err, UpdateNicknameVO } from '@nao-todo/types'

export default defineStore('UserAppStore', () => {
    // @domain User Domain
    const userDomain = useUserDomain(useUserRepository(getRequesterImpl()))

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

    return { updateNickname }
})
