import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useProjectStoreV2 } from '@nao-todo/stores'
import { getProjects } from '@nao-todo/handlers/project-handlers'
import type { Project, FetchProjectsOptions } from '@nao-todo/stores/use-project-store/v2/types'

export const useProjectManagerStore = defineStore('projectManagerStore', () => {
    const projectStore = useProjectStoreV2()

    const projects = ref<Project[]>([])
    const fetchOptions = ref<FetchProjectsOptions>({
        page: 1,
        limit: 10,
        sort: { field: 'createdAt', order: 'desc' }
    })

    const getData = async () => {
        const result = await projectStore.fetchProjects(fetchOptions.value)
        return (result.code === 20000 ? result.data : []) as Project[]
    }

    const init = async () => {
        projects.value = await getData()
    }

    // const refresh = async () => {}

    return {
        projects,
        init
    }
})
