import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Requester,
    GetProjectsOptions,
    CreateProjectOptions,
    ResponseData,
    Project,
    UpdateProjectOptions,
    GetProjectOptions,
    GetProjectsSortOptions,
    ProjectPreference
} from '@nao-todo/types'

export const createProjectApi = async (requester: Requester, options: CreateProjectOptions) => {
    try {
        const response = await requester.post('/project/', options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-project-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const deleteProjectApi = async (
    requester: Requester,
    projectId: Project['id'],
    isHard: boolean
) => {
    try {
        const response = await requester.delete(`/project/${projectId}?hard=${isHard}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-project-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const restoreProjectApi = async (requester: Requester, projectId: Project['id']) => {
    try {
        const response = await requester.put(`/project/restore/${projectId}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/restore-project-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateProjectApi = async (
    requester: Requester,
    projectId: Project['id'],
    options: UpdateProjectOptions
) => {
    try {
        const response = await requester.put(`/project/${projectId}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-project-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getProjectApi = async (requester: Requester, options: GetProjectOptions) => {
    try {
        const response = await requester.get(`/project/${options.id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-project-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getProjectsApi = async (requester: Requester, options: GetProjectsOptions) => {
    try {
        let queryString = stringifyGetOptions(options, (key: unknown, value: any) => {
            if (key === 'sort' && value) {
                return `${key}=${(value as GetProjectsSortOptions).field}:${(value as GetProjectsSortOptions).order}`
            }
        })
        queryString = queryString ? `?${queryString}` : ''
        const response = await requester.get(`/projects/${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-projects-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateProjectPreferenceApi = async (
    requester: Requester,
    projectId: Project['id'],
    preference: ProjectPreference
) => {
    const _preference: { [key in keyof ProjectPreference]?: string } = {}
    // 将对象偏好转为字符串
    try {
        _preference.getTodosOptions = preference.getTodosOptions
            ? JSON.stringify(preference.getTodosOptions)
            : ''
        _preference.columns = preference.columns ? JSON.stringify(preference.columns) : ''
    } catch (error) {
        console.error('[@nao-todo/apis/update-project-preference-v2]', error)
        return { code: 400, message: '偏好数据解析失败' } as ResponseData
    }
    // 更新清单偏好
    try {
        const response = await requester.put(`/project/preference/${projectId}`, _preference)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-project-preference-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
