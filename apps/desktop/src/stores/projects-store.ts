import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLoadingErrorStoreBase, useProjectsStoreBase } from './base'
import { useProjectPreferenceStoreBase } from './base/project'
import type { ProjectPreferenceStoreBase, ProjectsStoreBase } from './base/project'

export default defineStore('ProjectsStore', () => {
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
    } = useProjectsStoreBase() as ProjectsStoreBase

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
    } = useProjectPreferenceStoreBase() as ProjectPreferenceStoreBase

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

