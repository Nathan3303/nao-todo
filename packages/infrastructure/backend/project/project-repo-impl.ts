import {
    createProjectValueObject2Req,
    updateProjectValueObject2Req,
    listProjectRes2Entities,
    projectRes2Entity,
    createProjectRes2Entity
} from './converters'
import type { Requester } from '@nao-todo/infrastructure/requester'
import type { GoAsync } from '@nao-todo/types'
import type {
    ProjectRes,
    CreateProjectRes,
    ListProjectRes,
    ResponseData,
    BatchUpdateProjectRes
} from '../models'
import {
    ProjectEntity,
    CreateProjectValueObject,
    UpdateProjectValueObject
} from '@nao-todo/domain/project'
import type { ProjectRepository } from '@nao-todo/domain/project'
import { getJWTFromLocalStorage } from '../utils'

/**
 * 项目仓库实现
 * @description 项目仓库实现类，用于处理项目的数据操作。
 */
export class ProjectRepoImpl implements ProjectRepository {
    /**
     * 项目仓库实现构造函数
     * @param requester 请求器实例
     */
    constructor(private requester: Requester) {}

    /**
     * 获取项目
     * @param id 项目 ID
     * @returns 项目实体
     */
    async get(id: string): GoAsync<ProjectEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/projects/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const projectEntity = projectRes2Entity(res.data as ProjectRes)
        // 4. 返回
        return [projectEntity, null]
    }

    /**
     * 创建项目
     * @param createVO 创建项目视图对象
     * @returns 项目实体
     */
    async create(createVO: CreateProjectValueObject): GoAsync<ProjectEntity> {
        // 1. 构建 rto
        const createRto = createProjectValueObject2Req(createVO)
        // 2. 调用接口
        const response = await this.requester.post('/projects/', createRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const projectEntity = createProjectRes2Entity(res.data as CreateProjectRes)
        // 5. 返回
        return [projectEntity, null]
    }

    /**
     * 更新项目
     * @param projectEntity 项目实体
     * @returns 项目 ID
     */
    async update(updateVO: UpdateProjectValueObject): GoAsync<void> {
        // 1. 构建 rto
        const rto = updateProjectValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put(`/projects/${updateVO.id}`, rto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20020) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * 删除项目
     * @param id 项目 ID
     * @returns 错误信息
     */
    async delete(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.delete(`/projects/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * @param id 项目 ID
     * @returns 错误信息
     */
    async restore(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.put(`/projects/restore/${id}`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * @param id 项目 ID
     * @returns 错误信息
     */
    async archive(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.put(`/projects/archive/${id}`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * @param id 项目 ID
     * @returns 错误信息
     */
    async unarchive(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.put(`/projects/unarchive/${id}`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
    async list(): GoAsync<ProjectEntity[]> {
        // 1. 调用接口
        const response = await this.requester.get('/projects/', {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 20070) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const projectEntities = listProjectRes2Entities(res.data as ListProjectRes)
        // 4. 返回
        return [projectEntities, null]
    }

    /**
     * 批量更新任务清单
     * @param projects 任务清单实体数组
     * @returns 批量更新结果
     */
    async batchUpdate(updateVOs: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]> {
        // 1. 构建 rto
        const updateRtos = updateVOs.map((vo) => updateProjectValueObject2Req(vo))
        // 2. 调用接口
        const response = await this.requester.put(
            '/projects/',
            { projects: updateRtos },
            { headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` } }
        )
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20100) {
            return [null, res.message]
        }
        // 4. 转换为结果
        return [
            listProjectRes2Entities((res.data as BatchUpdateProjectRes).projects as ListProjectRes),
            null
        ]
    }
}

/**
 * 创建项目仓库实例
 * @param requester 请求器实例
 * @returns 项目仓库实例
 */
export const newProjectRepository = (requester: Requester) => {
    return new ProjectRepoImpl(requester)
}

