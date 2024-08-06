import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import type { User } from '@/stores'
import type { PageInfo, Project, ProjectFilterOptions, ProjectUpdateOptions } from './types'

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
        projects.value = []
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

    const update = async (
        userId: User['id'],
        id: Project['id'],
        updateOptions: ProjectUpdateOptions
    ) => {
        const URI = `/project?userId=${userId}&id=${id}`
        const idx = projects.value.findIndex((project) => project.id === id)
        const project = projects.value[idx]
        const newProject = { ...project, ...updateOptions }
        const response = await $axios.put(URI, newProject)
        if (response.data.code === '20000') {
            _update(id, updateOptions)
        }
        return response.data
    }

    const _update = (id: Project['id'], updateOptions: ProjectUpdateOptions) => {
        requestIdleCallback(() => {
            const projectIdx = projects.value.findIndex((project) => project.id === id)
            const newProject = { ...projects.value[projectIdx], ...updateOptions }
            projects.value.splice(projectIdx, 1, newProject)
            return newProject
        })
    }

    const toGetted = async (userId: User['id'], filterInfo?: ProjectFilterOptions) => {
        const filterQueryString = stringifyFilterInfo(filterInfo)
        const URI = `/projects?userId=${userId}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const _toFinded = (id: Project['id']) => {
        const project = projects.value.find((project) => project.id === id)
        if (!project) return null
        return project
    }

    return {
        project,
        projects,
        filterInfo,
        pageInfo,
        init,
        get,
        update,
        toGetted,
        _update,
        _toFinded
    }
})
