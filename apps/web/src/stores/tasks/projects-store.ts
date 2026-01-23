import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLoadingErrorStoreBase, useProjectStoreBase } from '../base'

export default defineStore('ProjectsStore', () => {
    // @storebase Project store base
    const { projects, setProjects, addProject, getProject } = useProjectStoreBase()

    // @storebase 内建项目存储加载/错误基础
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @returns
    return {
        projects: computed(() => projects.value),
        setProjects,
        addProject,
        getProject,
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        setLoading,
        setError
    }
})
