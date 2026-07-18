import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLoadingErrorStoreBase } from '@nao-todo/shared'
import { useProjectsStoreBase, useProjectPreferenceStoreBase } from '../hooks'

export const useProjectsStore = defineStore('ProjectsStore', () => {
    const {
        projects,
        getAllProjects,
        setProjects,
        addProject,
        getProject,
        updateProjects,
        softDeleteProject,
        deleteProject,
        restoreProject,
        updateProject
    } = useProjectsStoreBase()

    // @state 可用项目（按 sortId 排序）
    const avaliableProjects = computed(() => {
        return getAllProjects()
            .filter((p) => !p.isDeleted && !p.isArchived)
            .sort((a, b) => a.sortId - b.sortId)
    })

    const {
        projectPreference,
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useProjectPreferenceStoreBase()

    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        // --- Project ---
        projects,
        getAllProjects,
        setProjects,
        addProject,
        getProject,
        updateProjects,
        softDeleteProject,
        deleteProject,
        restoreProject,
        updateProject,
        avaliableProjects,
        // --- Project Preference ---
        projectPreference,
        setProjectPreference,
        getProjectPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions,
        // --- Loading Error ---
        loading,
        error,
        setLoading,
        setError,
        // --- Project Preference Loading Error ---
        preferenceLoading: computed(() => preferenceLoading.value),
        preferenceError: computed(() => preferenceError.value),
        setPreferenceLoading,
        setPreferenceError
    }
})
