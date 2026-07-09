import type { GoAsync } from '@nao-todo/types'
import type { UserConfigEntity } from '../entities/user-config'
import type { UpdateUserConfigValueObject } from '../valueobjects/update-config'

/**
 * 用户配置仓库接口
 * @description 用户配置仓库接口，包含用户配置相关操作
 */
export interface UserConfigRepository {
    /**
     * 获取用户配置
     * @description 获取用户配置
     * @returns 用户配置
     */
    get(): GoAsync<UserConfigEntity>

    /**
     * 更新用户配置
     * @description 更新用户配置
     * @param updateVO 更新用户配置视图对象
     * @returns 更新结果
     */
    save(updateVO: UpdateUserConfigValueObject): GoAsync<void>
}

