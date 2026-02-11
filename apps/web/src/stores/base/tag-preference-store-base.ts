import { ref } from 'vue'
import type { GetTasksOptions, TagPreference, TaskColumnOptions } from '@nao-todo/types'

const useTagPreferenceStoreBase = () => {
    // @state 标签偏好
    const tagPreference = ref<TagPreference>()

    // @action 设置标签偏好
    const setTagPreference = (preference: TagPreference) => {
        tagPreference.value = preference
    }

    // @action 获取标签偏好
    const getTagPreference = (): TagPreference | undefined => {
        return tagPreference.value
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        if (!tagPreference.value) return
        tagPreference.value.columns[key] = value
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        if (!tagPreference.value) return
        tagPreference.value.getTasksOptions[key] = value
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

export default useTagPreferenceStoreBase
export type TagPreferenceStoreBase = ReturnType<typeof useTagPreferenceStoreBase>
