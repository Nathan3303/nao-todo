import type { GoAsync } from '@nao-todo/shared'
import { TagEntity } from '../entities/tag'
import { CreateTagValueObject } from '../valueobjects/create-tag'
import { UpdateTagValueObject } from '../valueobjects/update-tag'

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
    get(id: string): GoAsync<TagEntity>

    /**
     * 创建标签
     * @param createVO 创建标签值对象
     * @returns 标签实体
     */
    create(createVO: CreateTagValueObject): GoAsync<TagEntity>

    /**
     * 更新标签
     * @param updateVO 更新标签值对象
     * @returns void
     */
    update(updateVO: UpdateTagValueObject): GoAsync<void>

    /**
     * 删除标签
     * @param id 标签ID
     * @returns void
     */
    delete(id: string): GoAsync<void>

    /**
     * 获取所有标签
     * @returns 标签实体数组
     */
    list(): GoAsync<TagEntity[]>

    /**
     * 批量更新标签
     * @param updateVOs 更新标签值对象数组
     * @returns 批量更新标签结果
     */
    batchUpdate(updateVOs: UpdateTagValueObject[]): GoAsync<TagEntity[]>
}

