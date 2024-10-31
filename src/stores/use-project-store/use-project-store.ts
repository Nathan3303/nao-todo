import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import type { User } from '@/stores'
import type {
    PageInfo,
    Project,
    ProjectFilterOptions,
    ProjectUpdateOptions,
    ProjectCreateOptions
} from './types'

export const useProjectStore = defineStore('projectStore', () => {
    const project = ref<Project>()
    const projects = ref<Project[]>([])
    const filterInfo = ref<ProjectFilterOptions>({})
    const pageInfo = reactive<PageInfo>({ page: 1, limit: 10, total: 0 })

    const stringifyFilterInfo = (specFilterInfo?: ProjectFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof ProjectFilterOptions]
            query.push(`${key}=${value}`)
        })
        return query.join('&')
    }

    const mergeFilterInfo = (newOne: ProjectFilterOptions) => {
        filterInfo.value = { ...filterInfo.value, ...newOne }
    }

    const getData = async (userId: User['id']) => {
        const filterQueryString = stringifyFilterInfo()
        const URI = `/projects?userId=${userId}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const reset = () => {
        // projects.value = []
        filterInfo.value = {}
    }

    const init = async (userId: User['id'], filterInfo: ProjectFilterOptions) => {
        reset()
        mergeFilterInfo(filterInfo)
        return await get(userId)
    }

    const get = async (userId: User['id']) => {
        const response = await getData(userId)
        if (response.code === '20000') {
            projects.value = response.data
        }
        return response
    }

    const create = async (userId: User['id'], createOptions: ProjectCreateOptions) => {
        const URI = `/project`
        const newProject = { userId, ...createOptions }
        const response = await $axios.post(URI, newProject)
        return response.data
    }

    const remove = async (userId: User['id'], id: Project['id']) => {
        const URI = `/project?userId=${userId}&projectId=${id}`
        const response = await $axios.delete(URI)
        if (response.data.code === '20000') get(userId)
        return response.data
    }

    const update = async (
        userId: User['id'],
        id: Project['id'],
        updateOptions: ProjectUpdateOptions
    ) => {
        const URI = `/project?userId=${userId}&projectId=${id}`
        const idx = projects.value.findIndex((project) => project.id === id)
        const project = projects.value[idx]
        const newProject = { ...project, ...updateOptions }
        const response = await $axios.put(URI, newProject)
        return response.data
    }

    const toGetted = async (userId: User['id'], filterInfo?: ProjectFilterOptions) => {
        const filterQueryString = stringifyFilterInfo(filterInfo)
        const URI = `/projects?userId=${userId}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const _create = (createOptions: ProjectCreateOptions) => {
        const newProject = { ...createOptions }
        projects.value.push(newProject as Project)
        return newProject
    }

    const _remove = (id: Project['id']) => {
        const idx = projects.value.findIndex((project) => project.id === id)
        if (idx === -1) return null
        return projects.value.splice(idx, 1)
    }

    const _update = (id: Project['id'], updateOptions: ProjectUpdateOptions) => {
        const projectIdx = projects.value.findIndex((project) => project.id === id)
        const newProject = { ...projects.value[projectIdx], ...updateOptions }
        // console.log(newProject);
        projects.value.splice(projectIdx, 1, newProject)
        return newProject
    }

    const _toFinded = (id: Project['id']) => {
        const project = projects.value.find((project) => project.id === id)
        if (!project) return null
        return project
    }

    const _toFiltered = (filterOptions: ProjectFilterOptions) => {
        const newProjects = projects.value.filter((project) => {
            const keys = Object.keys(filterOptions)
            return keys.every((key) => {
                const value = filterOptions[key as keyof ProjectFilterOptions]
                if (key === 'title') {
                    return project['title'] && project['title'].includes(value as string)
                }
                return project[key as keyof Project] === value
            })
        })
        return newProjects
    }

    const smartListData = computed(() => {
        const newProjects: Project[] = []
        const filterOptions = { isDeleted: false, isArchived: false } as ProjectFilterOptions
        projects.value.forEach((project) => {
            const isMatched = Object.keys(filterOptions).every((key) => {
                const value = filterOptions[key as keyof ProjectFilterOptions]
                return project[key as keyof Project] === value
            })
            if (isMatched) newProjects.push(project)
        })
        return newProjects
    })

    return {
        project,
        projects,
        filterInfo,
        pageInfo,
        smartListData,
        mergeFilterInfo,
        init,
        get,
        create,
        remove,
        update,
        toGetted,
        _create,
        _remove,
        _update,
        _toFinded,
        _toFiltered
    }
})
