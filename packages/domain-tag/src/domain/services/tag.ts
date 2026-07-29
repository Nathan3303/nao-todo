import type { GoAsync } from '@nao-todo/shared'
import type { TagRepository } from '../repositories/tag'
import { TagEntity } from '../entities/tag'
import type { CreateTagValueObject } from '../valueobjects/create-tag'
import type { UpdateTagValueObject } from '../valueobjects/update-tag'

/**
 * 标签服务
 * @description 标签服务，用于处理标签相关的业务逻辑
 */
export class TagService {
    /**
     * 标签服务构造函数
     * @param tagRepo 标签存储库
     */
    constructor(private tagRepo: TagRepository) {}

    /**
     * 创建标签
     * @param createTagValueObject 创建标签值对象
     * @returns 标签实体
     */
    async create(createTagValueObject: CreateTagValueObject): GoAsync<TagEntity> {
        const [newTagEntity, err] = createTagValueObject.toEntity()
        if (err !== null) {
            return [null, err]
        }
        return await this.tagRepo.create(newTagEntity)
    }

    /**
     * 更新标签
     * @param updateTagValueObject 更新标签值对象
     * @returns 更新结果
     */
    async update(updateTagValueObject: UpdateTagValueObject): GoAsync<void> {
        const [tagEntity, getError] = await this.tagRepo.getById(updateTagValueObject.id)
        if (getError !== null) {
            return getError
        }
        const updateWithError = updateTagValueObject.updateWith(tagEntity)
        if (updateWithError !== null) {
            return updateWithError
        }
        return await this.tagRepo.update(tagEntity)
    }

    /**
     * 批量更新标签
     * @param updateTagValueObjects 更新标签值对象列表
     * @returns 批量更新结果
     */
    async batchUpdate(updateTagValueObjects: UpdateTagValueObject[]): GoAsync<TagEntity[]> {
        const updateMap = new Map(updateTagValueObjects.map((item) => [item.id, item]))
        const [tagEntities, listError] = await this.tagRepo.getByIds(Array.from(updateMap.keys()))
        if (listError !== null) {
            return [null, listError]
        }
        const tagEntitiesMap = new Map(tagEntities.map((item) => [item.id, item]))
        const updatedEntities = updateTagValueObjects
            .map((vo) => {
                const e = tagEntitiesMap.get(vo.id)
                if (!e) return false
                const updateWithError = vo.updateWith(e)
                if (updateWithError !== null) return false
                return e
            })
            .filter((item) => item !== false)
        return this.tagRepo.batchUpdate(updatedEntities)
    }
}