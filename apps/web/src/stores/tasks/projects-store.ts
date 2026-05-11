import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLoadingErrorStoreBase, useProjectsStoreBase } from '../base'
import useProjectPreferenceStoreBase from '../base/project-preference-store-base'

export default defineStore('ProjectsStore', () => {
    // @storebase Project store base
    const {
        projects,
        getAllProjects,
        setProjects,
        addProject,
        getProject,
        softDeleteProject,
        deleteProject,
        restoreProject,
        updateProject
    } = useProjectsStoreBase()

    // @state 可用项目
    const availableProjects = computed(() => {
        return projects.filter((p) => !p.isDeleted && !p.isArchived)
    })

    // @storebase 内建项目存储加载/错误基础
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @storebase 项目偏好存储基础
    const {
        projectPreference,
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useProjectPreferenceStoreBase()

    // @storebase 项目偏好存储加载/错误基础
    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        projects,
        availableProjects,
        getAllProjects,
        setProjects,
        addProject,
        getProject,
        softDeleteProject,
        deleteProject,
        restoreProject,
        updateProject,
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        setLoading,
        setError,
        preferenceLoading: computed(() => preferenceLoading.value),
        preferenceError: computed(() => preferenceError.value),
        projectPreference: computed(() => projectPreference.value),
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions,
        setPreferenceLoading,
        setPreferenceError
    }
})

