import {
    UpdateUserConfigValueObject,
    UserConfigEntity,
    UserConfigRepository
} from '@nao-todo/domain/user'
import type { Requester } from '../../requester'
import { GoAsync } from '@nao-todo/types'
import { ResponseData, UserConfigRes } from '../models'
import { getUserConfigRes2Entity, updateUserConfigValueObject2Req } from './converters'

/**
 * 用户配置存储库实现
 * @description 用户配置存储库实现
 */
export class UserConfigRepoImpl implements UserConfigRepository {
    /**
     * 用户配置存储库实现
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * 获取用户配置
     * @description 获取用户配置
     * @returns 用户配置实体
     */
    async get(): GoAsync<UserConfigEntity> {
        // 获取用户配置
        const response = await this.requester.get('/user/config', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 处理响应
        const res = response.data as ResponseData
        if (res.code !== 10110) {
            return [null, res.message]
        }
        // 转换为用户配置实体
        return [getUserConfigRes2Entity(res.data as UserConfigRes), null]
    }

    /**
     * 更新用户配置
     * @description 更新用户配置
     * @param updateVO 更新用户配置值对象
     * @returns 更新结果
     */
    async save(updateVO: UpdateUserConfigValueObject): GoAsync<void> {
        // 转换值对象
        const updateRto = updateUserConfigValueObject2Req(updateVO)
        // 更新用户配置
        const response = await this.requester.put('/user/config', updateRto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 处理响应
        const res = response.data as ResponseData
        if (res.code !== 10120) {
            return res.message
        }
        return null
    }
}

/**
 * 创建用户配置仓库实例
 * @param requester 请求器
 * @returns 用户配置仓库实例
 */
export const newUserConfigRepository = (requester: Requester) => {
    return new UserConfigRepoImpl(requester)
}

