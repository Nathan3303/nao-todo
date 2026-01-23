import type { CreateTag, GoAsync, Tag, UpdateTag } from '@nao-todo/types'
import { TagDomain } from '@nao-todo/domain/tag'
import { tagEntity2ValueObject } from '../converters/tag'

export interface TagStore {
    setTags: (tags: Tag[]) => void
    addTag: (tag: Tag) => void
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
}
