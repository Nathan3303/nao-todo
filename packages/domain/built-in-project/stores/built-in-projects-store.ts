import { defineStore } from 'pinia'
import { useLoadingErrorStoreBase } from '@nao-todo/shared'
import { useBuiltInProjectsStoreBase, useBuiltInProjectPreferenceStoreBase } from '../hooks'
import { computed } from 'vue'

const useBuiltInProjectsStore = defineStore('BuiltInProjectsStore', () => {
    /**
     * 内建项目存储基础
     * 用于管理内建项目的加载状态和错误信息
     */
    const { builtInProjects, setBuiltInProjects, getBuiltInProject } = useBuiltInProjectsStoreBase()

    /**
     * 内建项目存储加载/错误基础
     * 用于管理内建项目的加载状态和错误信息
     */
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    /**
     * 内建项目偏好存储基础
     * 用于管理内建项目偏好的加载状态和错误信息
     */
    const {
        builtInProjectPreference,
        setBuiltInProjectPreference,
        getBuiltInProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useBuiltInProjectPreferenceStoreBase()

    /**
     * 内建项目偏好存储加载/错误基础
     * 用于管理内建项目偏好的加载状态和错误信息
     */
    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @return
    return {
        builtInProjects: computed(() => builtInProjects.value),
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        preferenceLoading: computed(() => preferenceLoading.value),
        preferenceError: computed(() => preferenceError.value),
        builtInProjectPreference: computed(() => builtInProjectPreference.value),
        setBuiltInProjects,
        getBuiltInProject,
        setLoading,
        setError,
        setPreferenceLoading,
        setPreferenceError,
        setBuiltInProjectPreference,
        getBuiltInProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    }
})

export default useBuiltInProjectsStore
export type BuiltInProjectsStore = ReturnType<typeof useBuiltInProjectsStore>
