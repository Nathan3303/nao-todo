import type { GoAsync } from '@nao-todo/shared/types'
import { TagPreferenceEntity } from '../entities/tag-preference'

/**
 * 标签偏好仓库接口
 * @description 标签偏好仓库接口，用于定义标签偏好相关的数据库操作
 */
export interface TagPreferenceRepository {
    /**
     * 获取标签偏好
     * @param id 标签偏好ID
     * @returns 标签偏好实体
     */
    get(id: string): GoAsync<TagPreferenceEntity>

    /**
     * 保存标签偏好
     * @param updatedEntity 更新后的标签偏好实体
     * @returns 无结果
     */
    save(updatedEntity: TagPreferenceEntity): GoAsync<void>
}