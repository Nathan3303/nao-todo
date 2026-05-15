import type { GoAsync } from '@nao-todo/types'
import type { TagRepository, BatchUpdateTagResult } from './repositories'
import { TagEntity, TagPreferenceEntity } from './entities'
import { CreateTagValueObject, UpdateTagValueObject } from './valueobjects'
import { unwrapError } from '@nao-todo/infrastructure/utils'

/**
 * 标签领域服务
 * @description 标签领域服务，用于处理标签相关的业务逻辑
 */
export class TagDomain {
    /**
     * 标签领域服务构造函数
     * @param tagRepo 标签存储库
     */
    constructor(private tagRepo: TagRepository) {}

    /**
     * 获取标签详情
     * @param tagId 标签ID
     * @returns 标签实体
     */
    async get(tagId: string): GoAsync<TagEntity> {
        return this.tagRepo.get(tagId)
    }

    /**
     * 获取所有标签详情
     * @returns 标签实体数组
     */
    async list(): GoAsync<TagEntity[]> {
        return this.tagRepo.list()
    }

    /**
     * 创建标签
     * @param createTagValueObject 创建标签值对象
     * @returns 标签实体
     */
    async create(createTagValueObject: CreateTagValueObject): GoAsync<TagEntity> {
        // 数据校验
        const validateErr = createTagValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 更新
        return this.tagRepo.create(createTagValueObject)
    }

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateTagValueObject 更新标签值对象
     * @returns 更新结果
     */
    async update(tagId: string, updateTagValueObject: UpdateTagValueObject): GoAsync<void> {
        return this.tagRepo.update(tagId, updateTagValueObject)
    }

    /**
     * 删除标签
     * @param tagId 标签ID
     * @returns 删除结果
     */
    async remove(tagId: string): GoAsync<void> {
        return this.tagRepo.remove(tagId)
    }

    /**
     * 获取标签偏好
     * @param tagId 标签ID
     * @returns 标签偏好实体
     */
    async getPreference(tagId: string): GoAsync<TagPreferenceEntity> {
        return this.tagRepo.getPreference(tagId)
    }
    /**
     * 更新标签偏好
     * @param tagId 标签ID
     * @param preferenceEntity 标签偏好实体
     * @returns 偏好更新结果
     */
    async updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string> {
        return this.tagRepo.updatePreference(tagId, preferenceEntity)
    }

    async batchUpdate(tags: UpdateTagValueObject[]): GoAsync<BatchUpdateTagResult> {
        return this.tagRepo.batchUpdate(tags)
    }
}
