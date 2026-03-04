import type { CreateTag, GoAsync, Tag, TagPreference, UpdateTag } from '@nao-todo/types'
import { TagDomain } from '@nao-todo/domain/tag'
import {
    tagEntity2ValueObject,
    tagPreferenceEntity2ValueObject,
    tagPreferenceVO2Entity
} from '../converters/tag'
import { NueConfirm } from 'nue-ui'

export interface TagStore {
    setTags: (tags: Tag[]) => void
    addTag: (tag: Tag) => void
    setTagPreference: (preference: TagPreference) => void
    updateTag: (tagId: Tag['id'], updateVO: UpdateTag) => void
}

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
        // 1. 调用领域层方法
        const [tagEntities, err] = await this.tagDomain.list()
        if (err !== null) {
            return err
        }
        // 2. 转换为视图对象
        const tags = tagEntities.map(tagEntity2ValueObject)
        // 3. 存储到状态管理
        this.store.setTags(tags)
        return null
    }

    /**
     * 创建标签
     * @param createVO 创建标签视图对象
     * @returns 标签视图对象
     */
    async create(createVO: CreateTag): GoAsync<Tag> {
        // 1. 调用领域层方法
        const [tagEntity, err] = await this.tagDomain.create(createVO)
        if (err !== null) {
            return [null, err]
        }
        // 2. 转换为视图对象
        const tag = tagEntity2ValueObject(tagEntity)
        // 3. 存储到状态管理
        this.store.addTag(tag)
        return [tag, null]
    }

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateVO 更新标签视图对象
     * @returns 标签视图对象
     */
    async update(tagId: Tag['id'], updateVO: Partial<Tag>): GoAsync<void> {
        // 1. 调用领域层方法
        const err = await this.tagDomain.update(tagId, updateVO)
        if (err !== null) {
            return err
        }
        // 2. 存储到状态管理
        this.store.updateTag(tagId, updateVO)
        return null
    }

    /**
     * 加载标签偏好
     * @param tagId 标签ID
     * @returns 标签偏好视图对象
     */
    async loadTagPreference(tagId: Tag['id']): GoAsync<void> {
        // 1. 调用领域层方法
        const [preferenceEntity, err] = await this.tagDomain.getPreference(tagId)
        if (err !== null) {
            return err
        }
        // 2. 转换为视图对象
        const preference = tagPreferenceEntity2ValueObject(preferenceEntity)
        preference.tagId = tagId
        preference.getTasksOptions.tagId = tagId
        // 3. 存储到状态管理
        this.store.setTagPreference(preference)
        return null
    }

    /**
     * 保存标签偏好
     * @param tagId 标签ID
     * @param newPreference 标签偏好视图对象
     * @returns 错误信息
     */
    async savePreference(tagId: Tag['id'], newPreference: TagPreference): GoAsync<void> {
        // 1. 判断项目偏好是否存在
        if (!newPreference) {
            return new Error('项目偏好无效')
        }
        // 2. 存储项目偏好实体
        const preferenceEntity = tagPreferenceVO2Entity(newPreference)
        const [, err] = await this.tagDomain.updatePreference(tagId, preferenceEntity)
        return err
    }

    /**
     * 删除标签
     * @param tagId 标签ID
     * @returns 无
     */
    async delete(tagId: Tag['id']): GoAsync<void> {
        // 1. 询问用户是否确认删除
        const [isByCancel] = await NueConfirm({
            title: '确认删除标签',
            content: '删除标签后可以在 标签管理 中恢复。是否继续？',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        })
        // 2. 判断用户是否取消删除
        if (isByCancel) {
            return null
        }
        // 3. 调用领域层方法
        return await this.tagDomain.remove(tagId)
    }
}
