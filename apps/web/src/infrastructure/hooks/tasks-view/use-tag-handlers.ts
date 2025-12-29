import type { TagApp } from '@nao-todo/application/tag'
import type { TagVO } from '@nao-todo/types'

const useTagHandlers = (tagApp: TagApp) => {
    // @method 根据 tagId 列表获取 tag 列表
    // 用于任务列表中显示 tag 信息
    const getTagsByTagIds = (tagIds: TagVO['id'][]): TagVO[] => {
        const _tags = tagIds.map((tagId) => {
            return tagApp.getByIdFromMap(tagId)
        })
        return _tags.filter((tag) => tag !== undefined)
    }

    // @returns 标签相关的处理函数
    return {
        getTagsByTagIds
    }
}

export default useTagHandlers
