import type { ProjectEntity } from '../entities/project'
import type { GoAsync } from '@nao-todo/shared'
import type { ProjectRepository } from '../repositories/project'
import type { CreateProjectValueObject } from '../valueobjects/create-project'
import type { UpdateProjectValueObject } from '../valueobjects/update-project'

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
     * 创建任务清单
     * @param createProjectValueObject 创建任务清单值对象
     * @returns 任务清单实体
     */
    async create(createProjectValueObject: CreateProjectValueObject): GoAsync<ProjectEntity> {
        // 数据校验
        const validateErr = createProjectValueObject.validate()
        if (validateErr !== null) {
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
    async update(updateProjectValueObject: UpdateProjectValueObject): GoAsync<void> {
        // 数据校验
        const validateErr = updateProjectValueObject.validate()
        if (validateErr !== null) {
            return validateErr
        }
        // 更新任务清单
        return this.projectRepo.update(updateProjectValueObject)
    }

    /**
     * 批量更新项目
     * @param updateVOs 更新项目值对象数组
     * @returns 更新后的项目实体数组
     */
    async batchUpdate(updateVOs: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]> {
        // 数据校验
        const validateErr = updateVOs.map((vo) => vo.validate())
        const errors = validateErr.filter((err) => err !== null)
        if (errors.length > 0) {
            return [null, new Error('批量更新项目失败', { cause: errors })]
        }
        // 批量更新项目
        return await this.projectRepo.batchUpdate(updateVOs)
    }
}

