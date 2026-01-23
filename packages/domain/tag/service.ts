import type { TagEntity, TagPreferenceEntity } from './entities'
import type { CreateTag, GoAsync, UpdateTag } from '@nao-todo/types'
import type { TagRepository } from './repositories'

export class TagDomain {
    /**
     * 标签领域服务
     * @param tagRepo 标签存储库
     */
    constructor(private tagRepo: TagRepository) {}

    /**
     * 获取标签
     * @param tagId 标签ID
     * @returns 标签实体
     */
    async get(tagId: string): GoAsync<TagEntity> {
        return this.tagRepo.get(tagId)
    }

    /**
     * 获取所有标签
     * @returns 标签实体数组
     */
    async list(): GoAsync<TagEntity[]> {
        return this.tagRepo.list()
    }

    /**
     * 创建标签
     * @param createTag 创建标签视图对象
     * @returns 标签实体
     */
    async create(createTag: CreateTag): GoAsync<TagEntity> {
        return this.tagRepo.create(createTag)
    }

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateTag 更新标签视图对象
     * @returns 无
     */
    async update(tagId: string, updateTag: UpdateTag): GoAsync<void> {
        return this.tagRepo.update(tagId, updateTag)
    }

    /**
     * 删除标签
     * @param tagId 标签ID
     * @returns 无
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
     * @returns 无
     */
    async updatePreference(tagId: string, preferenceEntity: TagPreferenceEntity): GoAsync<string> {
        return this.tagRepo.updatePreference(tagId, preferenceEntity)
    }
}
