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
    getTag: (tagId: TagViewObject['id']) => TagViewObject | undefined
    getAllTags: () => TagViewObject[]
    updateTag: (tagId: TagViewObject['id'], updateTagViewObject: UpdateTagViewObject) => void
    updateTags: (newTags: TagViewObject[]) => void
    deleteTag: (tagId: TagViewObject['id']) => void
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

    /**
     * 加载标签
     * @returns 标签视图对象数组
     */
    async loadTags(): GoAsync<void> {
        // 调用领域层方法
        const [tagEntities, err] = await this.tagDomain.list()
        if (err !== null) return err
        // 按 sortId 排序
        const sorted = tagEntities.sort((a, b) => a.sortId - b.sortId)
        // 转换为视图对象
        const tags = tagEntitiesToViewObjects(sorted)
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
        const removeError = await this.tagDomain.remove(tagId)
        if (removeError !== null) return removeError
        this.store.deleteTag(tagId)
        return null
    }

    /**
     * 重新排序标签 - 使用浮动间隔排序法
     */
    async resort(
        originalId: TagViewObject['id'],
        boundId: TagViewObject['id'],
        isBefore: boolean
    ): GoAsync<void> {
        const originalTag = this.store.getTag(originalId)
        const boundTag = this.store.getTag(boundId)
        if (!originalTag || !boundTag) return '标签不存在'

        if (originalId === boundId) return null

        const allTags = this.store.getAllTags()
        if (allTags.length <= 1) return null

        const sortedTags = [...allTags].sort((a, b) => a.sortId - b.sortId)

        const originalIndex = sortedTags.findIndex((t) => t.id === originalId)
        const boundIndex = sortedTags.findIndex((t) => t.id === boundId)

        if (originalIndex === -1 || boundIndex === -1) return '标签不存在'

        const tempTags = [...sortedTags]
        tempTags.splice(originalIndex, 1)

        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }

        let prevTag: TagViewObject | null = null
        let nextTag: TagViewObject | null = null

        if (newIndex === 0) {
            nextTag = tempTags[0] || null
        } else if (newIndex === tempTags.length) {
            prevTag = tempTags[tempTags.length - 1] || null
        } else {
            prevTag = tempTags[newIndex - 1] || null
            nextTag = tempTags[newIndex] || null
        }

        // 如果原 sortId 在新位置依旧成立，则无需发送网络请求
        let isSortIdStillValid = false
        if (!prevTag) {
            isSortIdStillValid = originalTag.sortId < nextTag!.sortId
        } else if (!nextTag) {
            isSortIdStillValid = originalTag.sortId > prevTag.sortId
        } else {
            isSortIdStillValid =
                originalTag.sortId > prevTag.sortId && originalTag.sortId < nextTag.sortId
        }

        if (isSortIdStillValid) return null

        let newSortId: number
        const INTERVAL = 1000

        if (!prevTag) {
            newSortId = nextTag!.sortId - INTERVAL
        } else if (!nextTag) {
            newSortId = prevTag.sortId + INTERVAL
        } else {
            newSortId = Math.round((prevTag.sortId + nextTag.sortId) / 2)
        }

        const needsRebuild =
            (prevTag && nextTag && Math.abs(nextTag.sortId - prevTag.sortId) < 2) || newSortId <= 0

        if (needsRebuild) {
            return this.resortWithRebuild(originalId, boundId, isBefore)
        } else {
            return this.resortSingle(originalId, newSortId)
        }
    }

    async resortSingle(originalId: string, newSortId: number): GoAsync<void> {
        // 更新状态管理中的标签顺序
        this.store.updateTag(originalId, { sortId: newSortId })
        // 调用领域层方法更新标签顺序
        return await this.update(originalId, { sortId: newSortId })
    }

    async resortWithRebuild(originalId: string, boundId: string, isBefore: boolean): GoAsync<void> {
        const allTags = this.store.getAllTags()
        if (!allTags.length) return null

        const sortedTags = [...allTags].sort((a, b) => a.sortId - b.sortId)

        const originalIndex = sortedTags.findIndex((t) => t.id === originalId)
        const boundIndex = sortedTags.findIndex((t) => t.id === boundId)

        if (originalIndex === -1 || boundIndex === -1) return '标签不存在'

        const [movedTag] = sortedTags.splice(originalIndex, 1)

        let newIndex = boundIndex
        if (originalIndex < boundIndex) {
            newIndex = isBefore ? boundIndex - 1 : boundIndex
        } else {
            newIndex = isBefore ? boundIndex : boundIndex + 1
        }

        sortedTags.splice(newIndex, 0, movedTag || ({} as TagViewObject))

        const INTERVAL = 1000
        const tagsToUpdate = sortedTags.map((tag, index) => ({
            ...tag,
            sortId: (index + 1) * INTERVAL
        }))

        this.store.updateTags(tagsToUpdate)

        const [, err] = await this.tagDomain.batchUpdate(
            tagsToUpdate
                .map((tag) => ({ id: tag.id, sortId: tag.sortId }))
                .map((t) => updateTagViewObjectToValueObject(t.id, t as UpdateTagViewObject))
        )
        if (err !== null) return err

        return null
    }
}

