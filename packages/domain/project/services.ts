import type { ProjectEntity, ProjectPreferenceEntity } from './entities'
import type { GoAsync } from '@nao-todo/types'
import type { ProjectRepository } from './repositories'
import { CreateProjectValueObject } from './valueobjects'
import { UpdateProjectValueObject } from './valueobjects/update-project'
import { unwrapError } from '@nao-todo/infrastructure/utils'

/**
 * 任务清单领域服务
 * @description 任务清单领域服务，包含任务清单的领域逻辑
 */
export class ProjectDomain {
    /**
     * 任务清单领域服务构造函数
     * @param projectRepo 任务清单仓库
     */
    constructor(private projectRepo: ProjectRepository) {}

    /**
     * 获取任务清单
     * @param projectId 任务清单ID
     * @returns 任务清单实体
     */
    async get(projectId: string): GoAsync<ProjectEntity> {
        return this.projectRepo.get(projectId)
    }

    /**
     * 创建任务清单
     * @param createProjectValueObject 创建任务清单值对象
     * @returns 任务清单实体
     */
    async create(createProjectValueObject: CreateProjectValueObject): GoAsync<ProjectEntity> {
        // 数据校验
        const validateErr = createProjectValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 创建任务清单
        return this.projectRepo.create(createProjectValueObject)
    }

    /**
     * 更新任务清单
     * @param updateProjectValueObject 更新任务清单值对象
     * @returns 更新任务清单ID
     */
    async update(updateProjectValueObject: UpdateProjectValueObject): GoAsync<string> {
        // 数据校验
        const validateErr = updateProjectValueObject.validate()
        if (validateErr !== null) {
            console.error(unwrapError(validateErr))
            return [null, validateErr]
        }
        // 更新任务清单
        return this.projectRepo.update(updateProjectValueObject)
    }

    /**
     * 删除任务清单
     * @param projectId 任务清单ID
     */
    async remove(projectId: string): GoAsync<void> {
        return this.projectRepo.remove(projectId)
    }

    /**
     * 恢复任务清单
     * @param projectId 任务清单ID
     */
    async restore(projectId: string): GoAsync<void> {
        return this.projectRepo.restore(projectId)
    }

    /**
     * 归档任务清单
     * @param projectId 任务清单ID
     */
    async archive(projectId: string): GoAsync<void> {
        return this.projectRepo.archive(projectId)
    }

    /**
     * 取消归档任务清单
     * @param projectId 任务清单ID
     */
    async unarchive(projectId: string): GoAsync<void> {
        return this.projectRepo.unarchive(projectId)
    }

    /**
     * 获取任务清单列表
     * @returns 任务清单实体数组
     */
    async list(): GoAsync<ProjectEntity[]> {
        return this.projectRepo.list()
    }

    /**
     * 获取任务清单偏好
     * @param projectId 任务清单ID
     * @returns 任务清单偏好实体
     */
    async getPreference(projectId: string): GoAsync<ProjectPreferenceEntity> {
        return this.projectRepo.getPreference(projectId)
    }

    /**
     * 更新任务清单偏好
     * @param projectId 任务清单ID
     * @param preferenceEntity 任务清单偏好实体
     * @returns 更新任务清单偏好ID
     */
    async updatePreference(
        projectId: string,
        preferenceEntity: ProjectPreferenceEntity
    ): GoAsync<string> {
        return this.projectRepo.updatePreference(projectId, preferenceEntity)
    }
}
