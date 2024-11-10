import { ref } from 'vue'
import { defineStore } from 'pinia'
import $axios from '@nao-todo/utils/axios'
import { defaultFetchProjectsOptions } from './constants'
import type {
    Project,
    FetchProjectsOptions,
    UpdateProjectOptionsRaw,
    UpdateProjectOptions,
    DeleteProjectOptions,
    CreateProjectOptions,
    ResponseData,
    Intersection
} from './types'

const stringifyFetchOptions = <T>(
    options: T,
    eachHandler?: (key: string, value: unknown) => string
) => {
    const queryPairs: string[] = []
    for (const key in options) {
        if (!eachHandler) {
            queryPairs.push(`${key}=${options[key as keyof T]}`)
            continue
        }
        const handleResult = eachHandler(key, options[key as keyof T])
        if (handleResult) {
            queryPairs.push(handleResult)
        }
    }
    return queryPairs.join('&')
}

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])

    // 获取清单
    const fetchProjects = async (options: FetchProjectsOptions = defaultFetchProjectsOptions) => {
        try {
            const queryString = stringifyFetchOptions(options)
            const response = await $axios.get(`/projects?${queryString}`)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                console.log('[UseProjectStore] fetchProjects:', projects.value)
                if (options.toGetted) return responseData
                projects.value = responseData.data as Project[]
            }
            return { code: responseData.code, message: responseData.message } as ResponseData
        } catch (error) {
            console.error('[UseProjectStore] fetchProjects:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    // 更新清单
    const updateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
        try {
            const response = await $axios.put(`/project?projectId=${projectId}`, options)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                console.log('[UseProjectStore] updateProject:', projects.value)
                if (options.toGetted) return responseData
                const index = projects.value.findIndex((project) => project.id === projectId)
                if (index !== -1) {
                    const project = projects.value[index]
                    const projectKeys = Object.keys(project)
                    for (const key in projectKeys) {
                        if (!(key in options)) continue
                        project[key] = options[key as keyof UpdateProjectOptionsRaw]
                    }
                }
            }
            return { code: responseData.code, message: responseData.message } as ResponseData
        } catch (error) {
            console.error('[UseProjectStore] updateProject:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    // 删除清单
    const deleteProject = async (projectId: Project['id'], options: DeleteProjectOptions) => {
        try {
            const response = await $axios.delete(`/project?projectId=${projectId}`)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                const index = projects.value.findIndex((project) => project.id === projectId)
                const deletedProject = { ...projects.value[index] } as Project
                if (index !== -1) projects.value.splice(index, 1)
                if (options.toGetted) {
                    return {
                        code: responseData.code,
                        message: responseData.message,
                        data: deletedProject
                    } as ResponseData
                }
            }
            return { code: responseData.code, message: responseData.message } as ResponseData
        } catch (error) {
            console.error('[UseProjectStore] updateProject:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    // 添加清单
    const createProject = async (options: CreateProjectOptions) => {
        try {
            const response = await $axios.post(`/project`, options)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                const newProject = responseData.data as Project
                if (options.toGetted) return responseData
                projects.value.push(newProject)
            }
            return { code: responseData.code, message: responseData.message } as ResponseData
        } catch (error) {
            console.error('[UseProjectStore] createProject:', error)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    return { projects, fetchProjects, updateProject, deleteProject, createProject }
})
