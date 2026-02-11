import { defineStore } from 'pinia'
import {
    useBuiltInProjectsStoreBase,
    useBuiltInProjectPreferenceStoreBase,
    useLoadingErrorStoreBase
} from '../base'
import { computed } from 'vue'

const useBuiltInProjectsStore = defineStore('BuiltInProjectsStore', () => {
    // @storebase 内建项目存储基础
    const { builtInProjects, setBuiltInProjects, getBuiltInProject } = useBuiltInProjectsStoreBase()

    // @storebase 内建项目存储加载/错误基础
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @storebase 内建项目偏好存储基础
    const {
        builtInProjectPreference,
        setBuiltInProjectPreference,
        getBuiltInProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useBuiltInProjectPreferenceStoreBase()

    // @storebase 内建项目偏好存储加载/错误基础
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
