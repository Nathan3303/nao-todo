import type {
    GoAsync,
    ProjectViewObject,
    CreateProjectViewObject,
    ProjectPreferenceViewObject
} from '@nao-todo/types'
import { ProjectDomain } from '@nao-todo/domain/project/services'
import {
    createProjectViewObjectToValueObject,
    projectEntitiesToViewObjects,
    projectEntityToViewObject,
    projectPreferenceEntityToViewObject,
    projectPreferenceViewObjectToEntity
} from '../converters/project'
import { NueConfirm } from 'nue-ui'

export interface ProjectStore {
    setProjects: (projects: ProjectViewObject[]) => void
    addProject: (project: ProjectViewObject) => void
    setProjectPreference: (preference: ProjectPreferenceViewObject) => void
    getProject: (projectId: ProjectViewObject['id']) => ProjectViewObject | undefined
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
        // 询问用户是否确认删除
        const [isByCancel] = await NueConfirm({
            title: '确认删除项目',
            content: '删除项目后可以在 项目管理 中恢复。是否继续？',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        })
        // 判断用户是否取消删除
        if (isByCancel) return null
        // 删除
        return await this.projectDomain.remove(projectId)
    }

    /**
     * 归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async archive(projectId: ProjectViewObject['id']): GoAsync<void> {
        // 获取项目名称
        const projectName = this.store.getProject(projectId)?.name
        // 询问用户是否确认归档
        const [isByCancel] = await NueConfirm({
            title: '确认归档项目',
            content: `确认归档项目 ${projectName} 吗？`,
            confirmButtonText: '归档',
            cancelButtonText: '取消'
        })
        // 判断用户是否取消归档
        if (isByCancel) return null
        // 调用领域层方法
        return await this.projectDomain.archive(projectId)
    }
}
