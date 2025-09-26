import type {
    CreateProjectOptions,
    GetProjectOptions,
    GetProjectsOptions,
    GoLike,
    Project,
    ProjectPreference,
    Requester,
    UpdateProjectOptions
} from '@nao-todo/types'
import {
    createProjectApi,
    deleteProjectApi,
    getProjectsApi,
    getProjectApi,
    updateProjectApi,
    restoreProjectApi,
    updateProjectPreferenceApi
} from '@nao-todo/apis/v2'

const CREATE_PROJECT_SUCCESS_CODE = 20010
const GET_PROJECTS_SUCCESS_CODE = 20050
const GET_PROJECT_SUCCESS_CODE = 20000
const UPDATE_PROJECT_SUCCESS_CODE = 20020
const DELETE_PROJECT_SUCCESS_CODE = 20030
const RESTORE_PROJECT_SUCCESS_CODE = 20040
const UPDATE_PROJECT_PREFERENCE_SUCCESS_CODE = 20060

const createProjectHandler = async (
    options: CreateProjectOptions,
    requester: Requester
): Promise<GoLike> => {
    // 参数判断
    if (options.name === '') return [null, '清单名称不能为空']
    // 调用 API 创建清单
    const apiRes = await createProjectApi(requester, options)
    // 处理成功结果
    if (apiRes.code === CREATE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const getProjectsHandler = async (
    getOptions: GetProjectsOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 获取清单列表
    const apiRes = await getProjectsApi(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_PROJECTS_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const getProjectHandler = async (
    getOptions: GetProjectOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 获取清单信息
    const apiRes = await getProjectApi(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const updateProjectHandler = async (
    projectId: Project['id'],
    updateOptions: UpdateProjectOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新清单信息
    const apiRes = await updateProjectApi(requester, projectId, updateOptions)
    // 处理成功结果
    if (apiRes.code === UPDATE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const deleteProjectHandler = async (
    projectId: Project['id'],
    isHard: boolean,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）清单
    const apiRes = await deleteProjectApi(requester, projectId, isHard || false)
    // 处理成功结果
    if (apiRes.code === DELETE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const restoreProjectHandler = async (
    projectId: Project['id'],
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）清单
    const apiRes = await restoreProjectApi(requester, projectId)
    // 处理成功结果
    if (apiRes.code === RESTORE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const updateProjectPreferenceHandler = async (
    projectId: Project['id'],
    preference: ProjectPreference,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新清单偏好
    const apiRes = await updateProjectPreferenceApi(requester, projectId, preference)
    // 处理成功结果
    if (apiRes.code === UPDATE_PROJECT_PREFERENCE_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export {
    createProjectHandler,
    getProjectsHandler,
    getProjectHandler,
    updateProjectHandler,
    deleteProjectHandler,
    restoreProjectHandler,
    updateProjectPreferenceHandler
}
