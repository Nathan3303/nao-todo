import {
    createProjectRes2ProjectEntity,
    getProjectRes2ProjectEntity,
    listProjectRes2ProjectEntities
} from './converters'
import { ProjectEntity } from '@nao-todo/domain/project/entities'
import type { ProjectRepository } from '@nao-todo/domain/project/repositories'
import type { Requester } from '../../requester/types'
import type { Err, GoLike } from '@nao-todo/types'
import type {
    CreateProjectReq,
    CreateProjectRes,
    GetProjectRes,
    ListProjectRes,
    ResponseData,
    UpdateProjectReq,
    UpdateProjectRes
} from '../types'

export const useProjectRepository = (requester: Requester): ProjectRepository => {
    const get = async (projectId: string): Promise<GoLike<ProjectEntity | null>> => {
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
    const create = async (projectEntity: ProjectEntity): Promise<GoLike<ProjectEntity | null>> => {
        // 1. 构建 rto
        const rto: CreateProjectReq = {
            name: projectEntity.name,
            description: projectEntity.description
        }
        // 2. 调用接口
        const response = await requester.post('/projects', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        projectEntity = createProjectRes2ProjectEntity(res.data as CreateProjectRes)
        // 5. 返回
        return [projectEntity, null]
    }

    const update = async (
        projectId: string,
        projectEntity: ProjectEntity
    ): Promise<GoLike<string | null>> => {
        // 1. 构建 rto
        const rto: UpdateProjectReq = {}
        if (projectEntity.name) rto.name = projectEntity.name
        if (projectEntity.description) rto.description = projectEntity.description
        // 2. 调用接口
        const response = await requester.put(`/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
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

    const remove = async (projectId: string): Promise<Err> => {
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

    const restore = async (projectId: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/restore/${projectId}`, {
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

    const archive = async (projectId: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/archive/${projectId}`, {
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

    const unarchive = async (projectId: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.put(`/projects/unarchive/${projectId}`, {
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

    const list = async (): Promise<GoLike<ProjectEntity[] | null>> => {
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

    return { create, get, update, remove, restore, archive, unarchive, list }
}
