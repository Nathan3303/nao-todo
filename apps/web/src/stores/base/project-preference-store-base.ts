import { ref } from 'vue'
import type { GetTasksOptions, ProjectPreference, TaskColumnOptions } from '@nao-todo/types'

const useProjectPreferenceStoreBase = () => {
    // @state 项目偏好
    const projectPreference = ref<ProjectPreference>()

    // @action 设置项目偏好
    const setProjectPreference = (preference: ProjectPreference) => {
        projectPreference.value = preference
    }

    // @action 获取项目偏好
    const getProjectPreference = (): ProjectPreference | undefined => {
        return projectPreference.value
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        if (!projectPreference.value) return
        projectPreference.value.columns[key] = value
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        if (!projectPreference.value) return
        projectPreference.value.getTasksOptions[key] = value
    }

    // @action 获取偏好 - 任务获取选项(key)
    const getPreferenceGetTasksOption = <T extends keyof GetTasksOptions>(
        key: T
    ): GetTasksOptions[T] => {
        if (!projectPreference.value) return
        return projectPreference.value.getTasksOptions[key]
    }

    // @action 获取偏好 - 任务获取选项(所有)
    const getPreferenceGetTasksOptions = (): GetTasksOptions => {
        if (!projectPreference.value) return {}
        return projectPreference.value.getTasksOptions
    }

    // @return
    return {
        projectPreference,
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
}

export default useProjectPreferenceStoreBase
export type ProjectPreferenceStoreBase = ReturnType<typeof useProjectPreferenceStoreBase>
