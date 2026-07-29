import { ProjectPreferenceEntity, ProjectPreferenceRepository } from '@nao-todo/domain-project'
import type { Requester, GoAsync } from '@nao-todo/shared'
import { defaultProjectPreferenceRes2Entity, projectPreferenceRes2Entity } from './converters'
import { ProjectPreferenceRes, ResponseData } from '../models'
import { getJWTFromLocalStorage } from '../utils'

/**
 * 项目偏好仓库实现
 * @description 项目偏好仓库实现类，用于处理项目偏好数据操作。
 */
export class ProjectPreferenceRepoImpl implements ProjectPreferenceRepository {
    /**
     * 项目偏好仓库实现构造函数
     * @param requester 请求器实例
     */
    constructor(private requester: Requester) {}

    /**
     * 获取项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好实体
     */
    async getByProjectId(projectId: string): GoAsync<ProjectPreferenceEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/projects/${projectId}/preference`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        // 3. 判断结果
        if (res.code !== 20080) {
            return [defaultProjectPreferenceRes2Entity(projectId), null]
        }
        // 4. 获取失败则返回默认结果
        return [projectPreferenceRes2Entity(res.data as ProjectPreferenceRes), null]
    }

    /**
     * 保存项目偏好
     * @param updatedEntity 项目偏好实体
     * @returns 保存结果
     */
    async save(updatedEntity: ProjectPreferenceEntity): GoAsync<void> {
        // 1. 构建 rto
        const saveRto = {
            viewType: updatedEntity.viewType,
            getTasksOptions: updatedEntity.getTasksOptions.unmarshal(),
            columns: updatedEntity.columns.unmarshal()
        }
        // 2. 调用接口
        const response = await this.requester.post(
            `/projects/${updatedEntity.projectId}/preference`,
            saveRto,
            { headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` } }
        )
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 20090) {
            return res.message
        }
        // 4. 返回
        return null
    }
}

/**
 * 创建项目偏好仓库实例
 * @param requester 请求器实例
 * @returns 项目偏好仓库实例
 */
export const newProjectPreferenceRepository = (requester: Requester) => {
    return new ProjectPreferenceRepoImpl(requester)
}