import {
    ProjectPreferenceEntity,
    ProjectPreferenceRepository,
    SaveProjectPreferenceValueObject
} from '@nao-todo/domain/project'
import type { Requester } from '@nao-todo/infrastructure/requester'
import { GoAsync } from '@nao-todo/types'
import {
    defaultProjectPreferenceRes2Entity,
    projectPreferenceRes2Entity,
    saveProjectPreferenceValueObject2Req
} from './converters'
import { ProjectPreferenceRes, ResponseData } from '../models'

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
    async get(projectId: string): GoAsync<ProjectPreferenceEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/projects/${projectId}/preference`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        // 3. 判断结果
        if (res.code !== 20080) {
            return [defaultProjectPreferenceRes2Entity(), res.message]
        }
        // 4. 获取失败则返回默认结果
        return [projectPreferenceRes2Entity(res.data as ProjectPreferenceRes), null]
    }

    /**
     * 保存项目偏好
     * @param saveVO 保存偏好值对象
     * @returns 保存结果
     */
    async save(saveVO: SaveProjectPreferenceValueObject): GoAsync<void> {
        // 1. 构建 rto
        const saveRto = saveProjectPreferenceValueObject2Req(saveVO)
        // 2. 调用接口
        const response = await this.requester.post(
            `/projects/${saveVO.projectId}/preference`,
            saveRto,
            { headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` } }
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

