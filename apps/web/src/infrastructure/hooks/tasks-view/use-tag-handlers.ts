import type { TagApp } from '@nao-todo/application/tag'
import type { GetTasksSortOptions, GoAsync, TagPreferenceVO, TagVO } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'

export interface TagHandlers {
    getTagsByTagIds: (tagIds: TagVO['id'][]) => TagVO[]
    updateColumns: (key: string, value: boolean) => void
    savePreference: (tagId: TagVO['id'], preference: TagPreferenceVO) => GoAsync<void>
    updateSortOptions: (options: GetTasksSortOptions) => void
    clearSortOptions: () => void
}

const useTagHandlers = (tagApp: TagApp): TagHandlers => {
    // @method 根据 tagId 列表获取 tag 列表
    // 用于任务列表中显示 tag 信息
    const getTagsByTagIds = (tagIds: TagVO['id'][]): TagVO[] => {
        const _tags = tagIds.map((tagId) => {
            return tagApp.getByIdFromMap(tagId)
        })
        return _tags.filter((tag) => tag !== undefined)
    }

    // @method 更新列选项
    const updateColumns = (key: string, value: boolean) => {
        if (!tagApp.states.preference) return
        const oldValue = (tagApp.states.preference.columns as Record<string, boolean>)[key]
        if (oldValue === void 0 || oldValue === value) return
        ;(tagApp.states.preference.columns as Record<string, boolean>)[key] = value
        console.log('updateColumns', key, value)
    }

    // @method 更新清单偏好设置
    const savePreference = async (
        tagId: TagVO['id'],
        preference: TagPreferenceVO
    ): GoAsync<void> => {
        // 1. 校验参数
        if (!tagId || !preference) {
            return '参数错误'
        }
        // 2. 更新清单偏好
        const [, err] = await tagApp.updatePreference(tagId, preference)
        if (err !== null) {
            return '标签偏好更新失败' + unwrapError(err)
        }
        // 3. 更新成功
        return null
    }

    // @method 更新排序选项
    const updateSortOptions = (options: GetTasksSortOptions) => {
        if (!tagApp.states.preference) return
        if (
            options.field === tagApp.states.preference.getTasksOptions.sort?.field &&
            options.order === tagApp.states.preference.getTasksOptions.sort?.order
        ) {
            tagApp.states.preference.getTasksOptions.sort = undefined
            return
        }
        tagApp.states.preference.getTasksOptions.sort = options
    }

    // @method 清除排序选项
    const clearSortOptions = () => {
        if (!tagApp.states.preference) return
        tagApp.states.preference.getTasksOptions.sort = {
            field: 'createdAt',
            order: 'desc'
        }
    }

    // @returns 标签相关的处理函数
    return {
        getTagsByTagIds,
        updateColumns,
        savePreference,
        updateSortOptions,
        clearSortOptions
    }
}

export default useTagHandlers
