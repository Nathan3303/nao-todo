import { ref } from 'vue'
import type { BuiltInProjectPreference, GetTasksOptions, TaskColumnOptions } from '@nao-todo/types'

const useBuiltInProjectPreferenceStoreBase = () => {
    // @state 内建项目偏好
    const builtInProjectPreference = ref<BuiltInProjectPreference>()

    // @action 设置内建项目偏好
    const setBuiltInProjectPreference = (preference: BuiltInProjectPreference) => {
        builtInProjectPreference.value = preference
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        if (!builtInProjectPreference.value) return
        builtInProjectPreference.value.columns[key] = value
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        if (!builtInProjectPreference.value) return
        builtInProjectPreference.value.getTasksOptions[key] = value
    }

    // @action 获取偏好 - 任务获取选项(key)
    const getPreferenceGetTasksOption = <T extends keyof GetTasksOptions>(
        key: T
    ): GetTasksOptions[T] => {
        if (!builtInProjectPreference.value) return
        return builtInProjectPreference.value.getTasksOptions[key]
    }

    // @action 获取偏好 - 任务获取选项(所有)
    const getPreferenceGetTasksOptions = (): GetTasksOptions => {
        if (!builtInProjectPreference.value) return {}
        return builtInProjectPreference.value.getTasksOptions
    }

    // @return
    return {
        builtInProjectPreference,
        setBuiltInProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
}

export default useBuiltInProjectPreferenceStoreBase
export type BuiltInProjectPreferenceStoreBase = ReturnType<
    typeof useBuiltInProjectPreferenceStoreBase
>
