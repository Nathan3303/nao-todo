import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetProjectsOptions } from './constants'
import type {
    Project,
    GetProjectOptions,
    GetProjectsOptions,
    UpdateProjectOptions,
    CreateProjectOptions,
    ResponseData
} from '@nao-todo/types'

// 添加清单
export const createProject = async (options: CreateProjectOptions) => {
    try {
        const response = await $axios.post(`/project`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/project] createProject:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 删除清单
export const deleteProject = async (projectId: Project['id']) => {
    try {
        const response = await $axios.delete(`/project?projectId=${projectId}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/project] deleteProject:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 更新清单
export const updateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
    try {
        const response = await $axios.put(`/project?projectId=${projectId}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/project] updateProject:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取清单
export const getProject = async (options: GetProjectOptions) => {
    try {
        const response = await $axios.get('/project?projectId=' + options.id)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/project] fetchProject:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取清单（s）
export const getProjects = async (options: GetProjectsOptions = defaultGetProjectsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await $axios.get(`/projects?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/project] fetchProjects:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
