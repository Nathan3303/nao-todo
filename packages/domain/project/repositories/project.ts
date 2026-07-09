import type { GoAsync } from '@nao-todo/types'
import { ProjectEntity } from '../entities/project'
import { CreateProjectValueObject } from '../valueobjects/create-project'
import { UpdateProjectValueObject } from '../valueobjects/update-project'

/**
 * 项目仓库接口
 * @description 项目仓库接口，包含项目的数据库操作
 */
export interface ProjectRepository {
    /**
     * 获取项目
     * @param id 项目ID
     * @returns 项目实体
     */
    get(id: string): GoAsync<ProjectEntity>

    /**
     * 创建项目
     * @param createProjectValueObject 创建项目值对象
     * @returns 项目实体
     */
    create(createProjectValueObject: CreateProjectValueObject): GoAsync<ProjectEntity>

    /**
     * 更新项目
     * @param updateProjectValueObject 更新项目值对象
     * @returns 更新项目ID
     */
    update(updateProjectValueObject: UpdateProjectValueObject): GoAsync<void>

    /**
     * 删除项目
     * @param id 项目ID
     * @returns 错误信息
     */
    delete(id: string): GoAsync<void>

    /**
     * 恢复项目
     * @param id 项目ID
     * @returns 错误信息
     */
    restore(id: string): GoAsync<void>

    /**
     * 归档项目
     * @param id 项目ID
     * @returns 错误信息
     */
    archive(id: string): GoAsync<void>

    /**
     * 取消归档项目
     * @param id 项目ID
     * @returns 错误信息
     */
    unarchive(id: string): GoAsync<void>

    /**
     * 获取所有项目
     * @returns 项目实体数组
     */
    list(): GoAsync<ProjectEntity[]>

    /**
     * 批量更新项目
     * @param projects 项目值对象数组
     * @returns 批量更新结果
     */
    batchUpdate(projects: UpdateProjectValueObject[]): GoAsync<ProjectEntity[]>
}


