import type { GoAsync } from '@nao-todo/shared'
import { TagPreferenceEntity } from '../entities/tag-preference'
import { UpdateTagPreferenceValueObject } from '../valueobjects/update-tag-preference'

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
     * @param updateVO 更新标签偏好值对象
     * @returns 标签偏好实体
     */
    save(updateVO: UpdateTagPreferenceValueObject): GoAsync<void>
}

