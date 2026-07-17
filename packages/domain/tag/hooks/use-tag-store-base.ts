import type { TagPreferenceViewObject, TagViewObject } from '@nao-todo/usecases/tag'
import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/usecases/task'
import { useMapperStoreBase } from '../hooks/use-mapper-store-base'
import { useStoreBase } from '../hooks/use-store-base'

export const useTagsStoreBase = () => {
    const {
        list: tags,
        setList: setTags,
        addItem: addTag,
        patchItem: updateTag,
        updateList: updateTags,
        getItem: getTag,
        removeItem: deleteTag
    } = useMapperStoreBase<TagViewObject>()

    const getAllTags = () => {
        const allTags: TagViewObject[] = []
        tags.value.forEach((tag) => allTags.push(tag))
        return allTags
    }

    // @returns
    return {
        tags,
        setTags,
        addTag,
        updateTag,
        updateTags,
        getAllTags,
        getTag,
        deleteTag
    }
}

export const useTagPreferenceStoreBase = () => {
    const {
        state: tagPreference,
        setState: setTagPreference,
        patchState: updateTagPreference
    } = useStoreBase<TagPreferenceViewObject>()

    // @action 获取标签偏好
    const getTagPreference = (): TagPreferenceViewObject | undefined => {
        return tagPreference.value
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        updateTagPreference((state) => {
            state.columns[key] = value
            return state
        })
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        updateTagPreference((state) => {
            state.getTasksOptions[key] = value
            return state
        })
    }

    // @action 获取偏好 - 任务获取选项(key)
    const getPreferenceGetTasksOption = <T extends keyof GetTasksOptions>(
        key: T
    ): GetTasksOptions[T] => {
        if (!tagPreference.value) return
        return tagPreference.value.getTasksOptions[key]
    }

    // @action 获取偏好 - 任务获取选项(所有)
    const getPreferenceGetTasksOptions = (): GetTasksOptions => {
        if (!tagPreference.value) return {}
        return tagPreference.value.getTasksOptions
    }

    // @return
    return {
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
}

export type TagsStoreBase = ReturnType<typeof useTagsStoreBase>
export type TagPreferenceStoreBase = ReturnType<typeof useTagPreferenceStoreBase>

