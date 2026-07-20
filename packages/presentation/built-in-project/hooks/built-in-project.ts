import {
    useMapperStoreBase,
    useStoreBase,
    type GetTasksOptions,
    type TaskColumnOptions
} from '@nao-todo/shared'
import type { BuiltInProjectPreferenceViewObject, BuiltInProjectViewObject } from '@nao-todo/application/built-in-project/viewobjects'

export const useBuiltInProjectsStoreBase = () => {
    const {
        list: builtInProjects,
        setList: setBuiltInProjects,
        getItem: getBuiltInProject,
        patchItem: updateBuiltInProject,
        updateItem: setBuiltInProject
    } = useMapperStoreBase<BuiltInProjectViewObject>()

    // @return
    return {
        builtInProjects,
        setBuiltInProjects,
        getBuiltInProject,
        updateBuiltInProject,
        setBuiltInProject
    }
}

export const useBuiltInProjectPreferenceStoreBase = () => {
    const {
        state: builtInProjectPreference,
        setState: setBuiltInProjectPreference,
        patchState: updateBuiltInProjectPreference
    } = useStoreBase<BuiltInProjectPreferenceViewObject>()

    // @action 获取内建项目偏好
    const getBuiltInProjectPreference = (): BuiltInProjectPreferenceViewObject | undefined => {
        return builtInProjectPreference.value
    }

    // @action 设置偏好 - 列选项
    const updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        // if (!builtInProjectPreference.value) return
        // builtInProjectPreference.value.columns[key] = value
        updateBuiltInProjectPreference((state) => {
            state.columns[key] = value
            return state
        })
    }

    // @action 设置偏好 - 任务获取选项
    const updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => {
        updateBuiltInProjectPreference((state) => {
            state.getTasksOptions[key] = value
            return state
        })
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
        getBuiltInProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
}

export type BuiltInProjectsStoreBase = ReturnType<typeof useBuiltInProjectsStoreBase>
export type BuiltInProjectPreferenceStoreBase = ReturnType<
    typeof useBuiltInProjectPreferenceStoreBase
>
