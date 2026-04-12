import {
    createProjectRes2ProjectEntity,
    getProjectPreferenceRes2ProjectPreferenceEntity,
    getProjectRes2ProjectEntity,
    listProjectRes2ProjectEntities,
    preferenceEntity2UpdateProjectPreferenceReq
} from './converters'
import type { Requester } from '@nao-todo/infrastructure/requester'
import type { GoAsync } from '@nao-todo/types'
import type {
    CreateProjectReq,
    CreateProjectRes,
    GetProjectPreferenceRes,
    GetProjectRes,
    ListProjectRes,
    ResponseData,
    UpdateProjectPreferenceRes,
    UpdateProjectReq,
    UpdateProjectRes
} from '../types'
import { defaultPreference } from '@nao-todo/infrastructure/consts/preference'
import {
    ProjectEntity,
    ProjectPreferenceEntity,
    CreateProjectValueObject,
    UpdateProjectValueObject,
    type ProjectRepository
} from '@nao-todo/domain/project'

export const useProjectRepository = (requester: Requester): ProjectRepository => {
    /**
     * 获取项目
     * @param projectId 项目 ID
     * @returns 项目实体
     */
    const get = async (projectId: string): GoAsync<ProjectEntity> => {
        // 1. 调用接口
        const response = await requester.get(`/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const projectEntity = getProjectRes2ProjectEntity(res.data as GetProjectRes)
        // 4. 返回
        return [projectEntity, null]
    }

    /**
     * 创建项目
     * @param createVO 创建项目视图对象
     * @returns 项目实体
     */
    const create = async (
        createProjectValueObject: CreateProjectValueObject
    ): GoAsync<ProjectEntity> => {
        // 1. 构建 rto
        const rto = {} as CreateProjectReq
        if (createProjectValueObject.name) rto.name = createProjectValueObject.name
        if (createProjectValueObject.description)
            rto.description = createProjectValueObject.description
        // 2. 调用接口
        const response = await requester.post('/projects/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const projectEntity = createProjectRes2ProjectEntity(res.data as CreateProjectRes)
        // 5. 返回
        return [projectEntity, null]
    }

    /**
     * 更新项目
     * @param projectId 项目 ID
     * @param projectEntity 项目实体
     * @returns 项目 ID
     */
    const update = async (
        projectId: string,
        updateProjectValueObject: UpdateProjectValueObject
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto: UpdateProjectReq = {}
        if (updateProjectValueObject.name) rto.name = updateProjectValueObject.name
        if (updateProjectValueObject.description)
            rto.description = updateProjectValueObject.description
        // 2. 调用接口
        const response = await requester.put(`/projects/${projectId}`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20020) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateProjectRes
        return [data.projectId, null]
    }

    /**
     * 删除项目
     * @param projectId 项目 ID
     * @returns 错误信息
     */
    const remove = async (projectId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.delete(`/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 恢复项目
     * @param projectId 项目 ID
     * @returns 错误信息
     */
    const restore = async (projectId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/restore/${projectId}`, null, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20040) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 归档项目
     * @param projectId 项目 ID
     * @returns 错误信息
     */
    const archive = async (projectId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/archive/${projectId}`, null, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20050) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 取消归档项目
     * @param projectId 项目 ID
     * @returns 错误信息
     */
    const unarchive = async (projectId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/unarchive/${projectId}`, null, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20060) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 获取项目列表
     * @returns 项目实体数组
     */
    const list = async (): GoAsync<ProjectEntity[]> => {
        // 1. 调用接口
        const response = await requester.get('/projects/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 20070) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const projectEntities = listProjectRes2ProjectEntities(res.data as ListProjectRes)
        // 4. 返回
        return [projectEntities, null]
    }

    /**
     * 获取项目偏好
     * @param projectId 项目 ID
     * @returns 项目偏好实体
     */
    const getPreference = async (projectId: string): GoAsync<ProjectPreferenceEntity> => {
        // 1. 调用接口
        const response = await requester.get(`/projects/${projectId}/preference`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        // 3. 判断结果
        if (res.code === 20080) {
            return [
                getProjectPreferenceRes2ProjectPreferenceEntity(
                    res.data as GetProjectPreferenceRes
                ),
                null
            ]
        }
        // 4. 获取失败则返回默认结果
        return [
            new ProjectPreferenceEntity(
                '',
                projectId,
                defaultPreference.viewType,
                defaultPreference.getTasksOptions,
                defaultPreference.columns,
                '',
                ''
            ),
            null
        ]
    }

    /**
     * 更新项目偏好
     * @param projectId 项目 ID
     * @param preferenceEntity 项目偏好实体
     * @returns 项目 ID
     */
    const updatePreference = async (
        projectId: string,
        preferenceEntity: ProjectPreferenceEntity
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto = preferenceEntity2UpdateProjectPreferenceReq(preferenceEntity)
        // 2. 调用接口
        const response = await requester.post(`/projects/${projectId}/preference`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20090) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateProjectPreferenceRes
        return [data.projectId, null]
    }

    return {
        create,
        get,
        update,
        remove,
        restore,
        archive,
        unarchive,
        list,
        getPreference,
        updatePreference
    }
}

