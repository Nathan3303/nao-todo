import type { ProjectEntity } from '../entities/project'
import type { GoAsync } from '@nao-todo/shared'
import type { ProjectRepository } from '../repositories/project'
import type { CreateProjectValueObject } from '../valueobjects/create-project'
import type { UpdateProjectValueObject } from '../valueobjects/update-project'
import { ProjectPreferenceRepository } from '../repositories'
import { ProjectPreferenceEntity } from '../entities'
import { SaveProjectPreferenceValueObject } from '../valueobjects'

/**
 * 项目服务
 * @description 项目服务，包含项目的领域逻辑
 */
export class ProjectService {
    /**
     * 项目服务构造函数
     * @param projectRepo 项目仓库
     * @param projectPreferenceRepo 项目偏好仓库
     */
    constructor(
        private readonly projectRepo: ProjectRepository,
        private readonly projectPreferenceRepo: ProjectPreferenceRepository
    ) {}

    /**
     * 创建项目
     * @param createProjectValueObject 创建项目值对象
     * @returns 项目实体
     */
    async createProject(
        createProjectValueObject: CreateProjectValueObject
    ): GoAsync<ProjectEntity> {
        // 数据校验
        const validateErr = createProjectValueObject.validate()
        if (validateErr !== null) {
            return [null, validateErr]
        }
        // 创建项目
        return this.projectRepo.create(createProjectValueObject)
    }

    /**
     * 更新项目
     * @param updateProjectValueObject 更新项目值对象
     * @returns 更新项目ID
     */
    async updateProject(updateProjectValueObject: UpdateProjectValueObject): GoAsync<void> {
        // 数据校验
        const validateErr = updateProjectValueObject.validate()
        if (validateErr !== null) {
            return validateErr
        }
        // 更新项目
        return this.projectRepo.update(updateProjectValueObject)
    }

    /**
     * 批量更新项目
     * @param updateVOs 更新项目值对象数组
     * @returns 更新后的项目实体数组
     */
    async batchUpdateProject(updateVOs: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]> {
        // 数据校验
        const validateErr = updateVOs.map((vo) => vo.validate())
        const errors = validateErr.filter((err) => err !== null)
        if (errors.length > 0) {
            return [null, new Error('批量更新项目失败', { cause: errors })]
        }
        // 批量更新项目
        return await this.projectRepo.batchUpdate(updateVOs)
    }

    /**
     * 获取项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好实体
     */
    async getProjectPreference(projectId: string): GoAsync<ProjectPreferenceEntity> {
        return this.projectPreferenceRepo.getByProjectId(projectId)
    }

    /**
     * 保存项目偏好
     * @param projectId 项目 ID
     * @param updateVO 更新值对象
     * @returns 保存结果
     */
    async saveProjectPreference(
        projectId: string,
        updateVO: SaveProjectPreferenceValueObject
    ): GoAsync<void> {
        const [preferenceEntity, getError] =
            await this.projectPreferenceRepo.getByProjectId(projectId)
        if (getError !== null) {
            return getError
        }
        if (updateVO.viewType !== void 0) {
            preferenceEntity.changeViewType(updateVO.viewType)
        }
        if (updateVO.getTasksOptions !== void 0) {
            preferenceEntity.updateGetTasksOptions(updateVO.getTasksOptions)
        }
        if (updateVO.columns !== void 0) {
            preferenceEntity.updateColumns(updateVO.columns)
        }
        return await this.projectPreferenceRepo.save(preferenceEntity)
    }
}