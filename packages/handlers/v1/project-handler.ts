import { useAxios } from '@nao-todo/hooks/use-requester'
import type {
    CreateProjectOptions,
    GetProjectOptions,
    GetProjectsOptions,
    GoLike,
    Project,
    Requester,
    UpdateProjectOptions
} from '@nao-todo/types'
import {
    createProjectApi,
    deleteProjectApi,
    getProjectsApi,
    getProjectApi,
    updateProjectApi
} from '@nao-todo/apis/v2'

const CREATE_PROJECT_SUCCESS_CODE = 20010
const GET_PROJECTS_SUCCESS_CODE = 20050
const GET_PROJECT_SUCCESS_CODE = 20000
const UPDATE_PROJECT_SUCCESS_CODE = 20020
const DELETE_PROJECT_SUCCESS_CODE = 20030

const iReq = useAxios('http://localhost:3303/api/')

const createProjectHandler = async (
    options: CreateProjectOptions,
    requester?: Requester
): Promise<GoLike> => {
    // 参数判断
    if (options.name === '') return [null, '清单名称不能为空']
    // 调用 API 创建清单
    const apiRes = await createProjectApi(requester || iReq, options)
    // 处理成功结果
    if (apiRes.code === CREATE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const getProjectsHandler = async (
    getOptions: GetProjectsOptions,
    requester?: Requester
): Promise<GoLike> => {
    // 调用 API 获取清单列表
    const apiRes = await getProjectsApi(requester || iReq, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_PROJECTS_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const getProjectHandler = async (
    getOptions: GetProjectOptions,
    requester?: Requester
): Promise<GoLike> => {
    // 调用 API 获取清单信息
    const apiRes = await getProjectApi(requester || iReq, getOptions)
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
    requester?: Requester
): Promise<GoLike> => {
    // 调用 API 更新清单信息
    const apiRes = await updateProjectApi(requester || iReq, projectId, updateOptions)
    // 处理成功结果
    if (apiRes.code === UPDATE_PROJECT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

const deleteProjectHandler = async (
    projectId: Project['id'],
    isHard?: boolean,
    requester?: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）清单
    const apiRes = await deleteProjectApi(requester || iReq, projectId, isHard || false)
    // 处理成功结果
    if (apiRes.code === DELETE_PROJECT_SUCCESS_CODE) {
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
    deleteProjectHandler
}
