import type { GoAsync } from '@nao-todo/shared/types'
import type { UserConfigEntity } from '../entities'

/**
 * 用户配置仓库接口
 * @description 用户配置仓库接口，包含用户配置相关操作
 */
export interface UserConfigRepository {
    /**
     * 获取用户配置
     * @returns 用户配置
     */
    get(): GoAsync<UserConfigEntity>

    /**
     * 更新用户配置
     * @param updatedEntity 更新用户配置实体
     * @returns 更新结果
     */
    save(updatedEntity: UserConfigEntity): GoAsync<void>
}