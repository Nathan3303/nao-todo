import type { GoAsync } from '@nao-todo/shared'
import type { ProjectPreferenceEntity } from '../entities/project-preference'

export interface ProjectPreferenceRepository {
    /**
     * 获取项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好实体
     */
    getByProjectId(projectId: string): GoAsync<ProjectPreferenceEntity>

    /**
     * 保存项目偏好
     * @param saveVO 保存项目偏好值对象
     * @returns void
     */
    save(updatedEntity: ProjectPreferenceEntity): GoAsync<void>
}