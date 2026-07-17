import type { GoAsync } from '@nao-todo/shared'
import type { TagRepository } from '../repositories/tag'
import type { TagEntity } from '../entities/tag'
import type { CreateTagValueObject } from '../valueobjects/create-tag'
import type { UpdateTagValueObject } from '../valueobjects/update-tag'

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
     * 创建标签
     * @param createTagValueObject 创建标签值对象
     * @returns 标签实体
     */
    async create(createTagValueObject: CreateTagValueObject): GoAsync<TagEntity> {
        // 数据校验
        const validateErr = createTagValueObject.validate()
        if (validateErr !== null) {
            return [null, validateErr]
        }
        // 更新
        return this.tagRepo.create(createTagValueObject)
    }

    /**
     * 更新标签
     * @param updateTagValueObject 更新标签值对象
     * @returns 更新结果
     */
    async update(updateTagValueObject: UpdateTagValueObject): GoAsync<void> {
        // 数据校验
        const validateErr = updateTagValueObject.validate()
        if (validateErr !== null) {
            return validateErr
        }
        // 更新
        return this.tagRepo.update(updateTagValueObject)
    }

    /**
     * 批量更新标签
     * @param tags 更新标签值对象列表
     * @returns 批量更新结果
     */
    async batchUpdate(tags: UpdateTagValueObject[]): GoAsync<TagEntity[]> {
        // 数据校验
        const validateErr = tags.map((tag) => tag.validate())
        const hasErr = validateErr.some((item) => item !== null)
        if (hasErr) {
            return [
                null,
                new Error('批量更新标签失败', {
                    cause: validateErr.filter((item) => item !== null)
                })
            ]
        }
        // 更新
        return this.tagRepo.batchUpdate(tags)
    }
}

