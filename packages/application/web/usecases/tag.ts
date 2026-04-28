import type {
    GoAsync,
    TagViewObject,
    TagPreferenceViewObject,
    UpdateTagViewObject,
    CreateTagViewObject
} from '@nao-todo/types'
import { TagDomain } from '@nao-todo/domain/tag'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useTagRepository } from '@nao-todo/infrastructure/backend/tag/repoImpl'
import {
    createTagViewObjectToValueObject,
    tagEntitiesToViewObjects,
    tagEntityToViewObject,
    tagPreferenceEntityToViewObject,
    tagPreferenceViewObjectToEntity,
    updateTagViewObjectToValueObject
} from '../converters/tag'

/**
 * 标签状态管理
 */
export interface TagStore {
    setTags: (tags: TagViewObject[]) => void
    addTag: (tag: TagViewObject) => void
    setTagPreference: (tagPreferenceViewObject: TagPreferenceViewObject) => void
    updateTag: (tagId: TagViewObject['id'], updateTagViewObject: UpdateTagViewObject) => void
}

/**
 * 标签用例
 * @description 负责处理标签相关的业务逻辑，包括加载标签、创建标签、更新标签、加载标签偏好等
 */
export class TagUseCase {
    /**
     * 标签用例
     * @param tagDomain 标签领域服务
     * @param store 标签状态管理
     */
    constructor(
        private tagDomain: TagDomain,
        private store: TagStore
    ) {}

    /**
     * 加载标签
     * @returns 标签视图对象数组
     */
    async loadTags(): GoAsync<void> {
        // 调用领域层方法
        const [tagEntities, err] = await this.tagDomain.list()
        if (err !== null) return err
        // 转换为视图对象
        const tags = tagEntitiesToViewObjects(tagEntities)
        // 存储到状态管理
        this.store.setTags(tags)
        return null
    }

    /**
     * 创建标签
     * @param createTagViewObject 创建标签视图对象
     * @returns 标签视图对象
     */
    async create(createTagViewObject: CreateTagViewObject): GoAsync<TagViewObject> {
        // 数据转换：将视图对象转换为领域对象
        const createTagValueObject = createTagViewObjectToValueObject(createTagViewObject)
        // 创建
        const [tagEntity, err] = await this.tagDomain.create(createTagValueObject)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const tag = tagEntityToViewObject(tagEntity)
        // 存储到状态管理
        this.store.addTag(tag)
        return [tag, null]
    }

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateVO 更新标签视图对象
     * @returns 标签视图对象
     */
    async update(
        tagId: TagViewObject['id'],
        updateTagViewObject: UpdateTagViewObject
    ): GoAsync<void> {
        // 数据转换
        const updateTagValueObject = updateTagViewObjectToValueObject(tagId, updateTagViewObject)
        // 更新
        const err = await this.tagDomain.update(tagId, updateTagValueObject)
        if (err !== null) return err
        // 存储到状态管理
        this.store.updateTag(tagId, updateTagViewObject)
        return null
    }

    /**
     * 加载标签偏好
     * @param tagId 标签ID
     * @returns 标签偏好视图对象
     */
    async loadTagPreference(tagId: TagViewObject['id']): GoAsync<void> {
        // 调用领域层方法
        const [preferenceEntity, err] = await this.tagDomain.getPreference(tagId)
        if (err !== null) return err
        // 转换为视图对象
        const preference = tagPreferenceEntityToViewObject(preferenceEntity)
        // 存储到状态管理
        this.store.setTagPreference(preference)
        return null
    }

    /**
     * 保存标签偏好
     * @param tagId 标签ID
     * @param tagPreferenceViewObject 标签偏好视图对象
     * @returns 错误信息
     */
    async savePreference(
        tagId: TagViewObject['id'],
        tagPreferenceViewObject: TagPreferenceViewObject
    ): GoAsync<void> {
        // 判断项目偏好是否存在
        if (!tagPreferenceViewObject) return '项目偏好无效'
        // 数据转换
        const tagPreferenceEntity = tagPreferenceViewObjectToEntity(tagPreferenceViewObject)
        // 保存
        const [, err] = await this.tagDomain.updatePreference(tagId, tagPreferenceEntity)
        return err
    }

    /**
     * 删除标签
     * @param tagId 标签ID
     * @returns 无
     */
    async delete(tagId: TagViewObject['id']): GoAsync<void> {
        return await this.tagDomain.remove(tagId)
    }

    /**
     * 创建TagUseCase实例
     * @param tagStore 标签状态管理
     * @returns TagUseCase实例
     */
    static create(tagStore: TagStore): TagUseCase {
        const requester = getRequesterImpl()
        const repo = useTagRepository(requester)
        const domain = new TagDomain(repo)
        return new TagUseCase(domain, tagStore)
    }
}
