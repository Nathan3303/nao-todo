import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Requester,
    GetProjectsOptions,
    CreateProjectOptions,
    ResponseData,
    Project,
    UpdateProjectOptions,
    GetProjectOptions,
    GetProjectsSortOptions
} from '@nao-todo/types'

const defaultGetProjectsOptions: GetProjectsOptions = {
    isDeleted: false,
    page: 1,
    limit: 99
}

export const createProjectV2 = async (requester: Requester, options: CreateProjectOptions) => {
    try {
        const response = await requester(`/project`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-project-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteProjectV2 = async (requester: Requester, projectId: Project['id']) => {
    try {
        const response = await requester(`/project?projectId=${projectId}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-project-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateProjectV2 = async (
    requester: Requester,
    projectId: Project['id'],
    options: UpdateProjectOptions
) => {
    try {
        const response = await requester(`/project?projectId=${projectId}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-project-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getProjectV2 = async (requester: Requester, options: GetProjectOptions) => {
    try {
        const response = await requester('/project?projectId=' + options.id)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-project-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getProjectsV2 = async (
    requester: Requester,
    options: GetProjectsOptions = defaultGetProjectsOptions
) => {
    try {
        const queryString = stringifyGetOptions(options, (key, value) => {
            if (key === 'sort' && value) {
                return `${key}=${(value as GetProjectsSortOptions).field}:${(value as GetProjectsSortOptions).order}`
            }
        })
        const response = await requester(`/projects?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-projects-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
