import type {
    GoAsync,
    ProjectViewObject,
    CreateProjectViewObject,
    ProjectPreferenceViewObject
} from '@nao-todo/types'
import { ProjectDomain } from '@nao-todo/domain/project/services'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useProjectRepository } from '@nao-todo/infrastructure/backend/project/repoImpl'
import {
    createProjectViewObjectToValueObject,
    projectEntitiesToViewObjects,
    projectEntityToViewObject,
    projectPreferenceEntityToViewObject,
    projectPreferenceViewObjectToEntity
} from '../converters/project'

export interface ProjectStore {
    setProjects: (projects: ProjectViewObject[]) => void
    addProject: (project: ProjectViewObject) => void
    setProjectPreference: (preference: ProjectPreferenceViewObject) => void
    getProject: (projectId: ProjectViewObject['id']) => ProjectViewObject | undefined
    deleteProject: (projectId: ProjectViewObject['id']) => void
    softDeleteProject: (projectId: ProjectViewObject['id']) => void
    restoreProject: (projectId: ProjectViewObject['id']) => void
}

/**
 * 项目用例
 * @description 负责处理项目相关的业务逻辑，包括加载项目、创建项目、加载项目偏好等
 */
export class ProjectUseCase {
    /**
     * 项目用例构造函数
     * @param projectDomain 项目领域服务
     * @param store 项目状态管理
     */
    constructor(
        private projectDomain: ProjectDomain,
        private store: ProjectStore
    ) {}

    /**
     * 创建ProjectUseCase实例
     * @param projectStore 项目状态管理
     * @returns ProjectUseCase实例
     */
    static create(projectStore: ProjectStore): ProjectUseCase {
        const requester = getRequesterImpl()
        const repo = useProjectRepository(requester)
        const domain = new ProjectDomain(repo)
        return new ProjectUseCase(domain, projectStore)
    }

    /**
     * 加载项目
     * @returns 项目视图对象数组
     */
    async loadProjects(): GoAsync<void> {
        // 调用领域层方法
        const [projectEntities, err] = await this.projectDomain.list()
        if (err !== null) return err
        // 转换为视图对象
        const projects = projectEntitiesToViewObjects(projectEntities)
        // 存储到状态管理
        console.log(projects)
        this.store.setProjects(projects)
        return null
    }

    /**
     * 创建项目
     * @param createProjectViewObject 创建项目视图对象
     * @returns 项目视图对象
     */
    async create(createProjectViewObject: CreateProjectViewObject): GoAsync<ProjectViewObject> {
        // 数据转换：视图对象转换为值对象
        const createProjectValueObject =
            createProjectViewObjectToValueObject(createProjectViewObject)
        // 调用领域层方法
        const [projectEntity, err] = await this.projectDomain.create(createProjectValueObject)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const project = projectEntityToViewObject(projectEntity)
        // 存储到状态管理
        this.store.addProject(project)
        return [project, null]
    }

    /**
     * 加载项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好视图对象
     */
    async loadProjectPreference(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 调用领域层方法
        const [preferenceEntity, err] = await this.projectDomain.getPreference(projectId)
        if (err !== null) return err
        // 转换为视图对象
        const preference = projectPreferenceEntityToViewObject(preferenceEntity)
        // 存储到状态管理
        this.store.setProjectPreference(preference)
        // 返回
        return null
    }

    /**
     * 保存标签偏好
     * @param projectId 项目ID
     * @param projectPreferenceViewObject 新项目偏好视图对象
     * @returns 错误信息
     */
    async savePreference(
        projectId: ProjectViewObject['id'],
        projectPreferenceViewObject: ProjectPreferenceViewObject
    ): GoAsync<void> {
        // 判断项目偏好是否存在
        if (!projectPreferenceViewObject) return '项目偏好无效'
        // 转换为项目偏好实体
        const preferenceEntity = projectPreferenceViewObjectToEntity(projectPreferenceViewObject)
        // 存储项目偏好实体
        const [, err] = await this.projectDomain.updatePreference(projectId, preferenceEntity)
        return err
    }

    /**
     * 删除项目
     * @param projectId 项目ID
     * @returns 无
     */
    async delete(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 删除任务清单
        const err = await this.projectDomain.remove(projectId)
        if (err !== null) return err
        // 更新状态管理
        this.store.softDeleteProject(projectId)
        return null
    }

    /**
     * 恢复项目
     * @param projectId 项目ID
     * @returns 无
     */
    async restore(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 恢复任务清单
        const err = await this.projectDomain.restore(projectId)
        if (err !== null) return err
        // 更新状态管理
        this.store.restoreProject(projectId)
        return null
    }

    /**
     * 归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async archive(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 直接调用，不做确认
        return await this.projectDomain.archive(projectId)
    }

    /**
     * 取消归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async unarchive(projectId: ProjectViewObject['id']): GoAsync<void> {
        return await this.projectDomain.unarchive(projectId)
    }
}

