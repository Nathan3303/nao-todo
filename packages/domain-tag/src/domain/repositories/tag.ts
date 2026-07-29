import type { GoAsync } from '@nao-todo/shared'
import { TagEntity } from '../entities/tag'

/**
 * 标签仓库接口
 * @description 标签仓库接口，用于定义标签的数据库操作
 */
export interface TagRepository {
    /**
     * 获取标签
     * @param id 标签ID
     * @returns 标签实体
     */
    getById(id: string): GoAsync<TagEntity>

    /**
     * 创建标签
     * @param createdEntity 创建标签实体
     * @returns 标签实体
     */
    create(createdEntity: TagEntity): GoAsync<TagEntity>

    /**
     * 更新标签
     * @param updatedEntity 更新标签实体
     * @returns void
     */
    update(updatedEntity: TagEntity): GoAsync<void>

    /**
     * 删除标签
     * @param id 标签ID
     * @returns void
     */
    deleteById(id: string): GoAsync<void>

    /**
     * 获取所有标签
     * @returns 标签实体数组
     */
    list(): GoAsync<TagEntity[]>

    /**
     * 获取标签列表
     * @param ids 标签ID数组
     * @returns 标签实体数组
     */
    getByIds(ids: string[]): GoAsync<TagEntity[]>

    /**
     * 批量更新标签
     * @param updatedEntities 更新标签实体数组
     * @returns 批量更新标签结果
     */
    batchUpdate(updatedEntities: TagEntity[]): GoAsync<TagEntity[]>
}