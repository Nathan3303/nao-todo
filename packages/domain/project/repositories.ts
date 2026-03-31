import type { GoAsync } from '@nao-todo/types'
import type { ProjectEntity, ProjectPreferenceEntity } from './entities'
import { CreateProjectValueObject, UpdateProjectValueObject } from './valueobjects'

/**
 * 任务清单仓库接口
 * @description 任务清单仓库接口，包含任务清单的数据库操作
 */
export interface ProjectRepository {
    /**
     * 获取任务清单
     * @param projectId 任务清单ID
     * @returns 任务清单实体
     */
    get(projectId: string): GoAsync<ProjectEntity>

    /**
     * 创建任务清单
     * @param createProjectValueObject 创建任务清单值对象
     * @returns 任务清单实体
     */
    create(createProjectValueObject: CreateProjectValueObject): GoAsync<ProjectEntity>

    /**
     * 更新任务清单
     * @param projectId 任务清单ID
     * @param updateProjectValueObject 更新任务清单值对象
     * @returns 更新任务清单ID
     */
    update(projectId: string, updateProjectValueObject: UpdateProjectValueObject): GoAsync<string>

    /**
     * 删除任务清单
     * @param projectId 任务清单ID
     * @returns 错误信息
     */
    remove(projectId: string): GoAsync<void> // like delete

    /**
     * 恢复任务清单
     * @param projectId 任务清单ID
     * @returns 错误信息
     */
    restore(projectId: string): GoAsync<void>

    /**
     * 归档任务清单
     * @param projectId 任务清单ID
     * @returns 错误信息
     */
    archive(projectId: string): GoAsync<void>

    /**
     * 取消归档任务清单
     * @param projectId 任务清单ID
     * @returns 错误信息
     */
    unarchive(projectId: string): GoAsync<void>

    /**
     * 获取所有任务清单
     * @returns 任务清单实体数组
     */
    list(): GoAsync<ProjectEntity[]>

    /**
     * 获取任务清单偏好
     * @param projectId 任务清单ID
     * @returns 任务清单偏好实体
     */
    getPreference(projectId: string): GoAsync<ProjectPreferenceEntity>

    /**
     * 更新任务清单偏好
     * @param projectId 任务清单ID
     * @param preferenceEntity 任务清单偏好实体
     * @returns 更新任务清单偏好ID
     */
    updatePreference(projectId: string, preferenceEntity: ProjectPreferenceEntity): GoAsync<string>
}
