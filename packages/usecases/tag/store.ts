import type { TagPreferenceViewObject, TagViewObject, UpdateTagViewObject } from './viewobjects'

/**
 * 标签存储接口
 */
export interface TagStore {
    /**
     * 设置所有标签
     * @param tags 标签视图对象数组
     */
    setTags: (tags: TagViewObject[]) => void

    /**
     * 添加标签
     * @param tag 标签视图对象
     */
    addTag: (tag: TagViewObject) => void

    /**
     * 设置标签偏好
     * @param tagPreferenceViewObject 标签偏好视图对象
     */
    setTagPreference: (tagPreferenceViewObject: TagPreferenceViewObject) => void

    /**
     * 获取标签
     * @param tagId 标签ID
     * @returns 标签视图对象
     */
    getTag: (tagId: TagViewObject['id']) => TagViewObject | undefined

    /**
     * 获取所有标签
     * @returns 所有标签视图对象数组
     */
    getAllTags: () => TagViewObject[]

    /**
     * 更新标签
     * @param tagId 标签ID
     * @param updateTagViewObject 更新标签视图对象
     */
    updateTag: (tagId: TagViewObject['id'], updateTagViewObject: UpdateTagViewObject) => void

    /**
     * 更新所有标签
     * @param newTags 新的标签视图对象数组
     */
    updateTags: (newTags: TagViewObject[]) => void

    /**
     * 删除标签
     * @param tagId 标签ID
     */
    deleteTag: (tagId: TagViewObject['id']) => void
}

