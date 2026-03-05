import type { CreateProject, GoAsync, Project, ProjectPreference } from '@nao-todo/types'
import { ProjectDomain } from '@nao-todo/domain/project/services'
import {
    projectEntity2ViewObject,
    projectPreferenceEntity2ProjectPreferenceVO,
    projectPreferenceVO2Entity
} from '../converters/project'
import { NueConfirm } from 'nue-ui'

export interface ProjectStore {
    setProjects: (projects: Project[]) => void
    addProject: (project: Project) => void
    setProjectPreference: (preference: ProjectPreference) => void
    getProject: (projectId: Project['id']) => Project | undefined
}

export class ProjectUseCase {
    /**
     * 项目用例
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
        // 1. 调用领域层方法
        const [projectEntities, err] = await this.projectDomain.list()
        if (err !== null) {
            return err
        }
        // 2. 转换为视图对象
        const projects = projectEntities.map(projectEntity2ViewObject)
        // 3. 存储到状态管理
        this.store.setProjects(projects)
        return null
    }

    /**
     * 创建项目
     * @param createVO 创建项目视图对象
     * @returns 项目视图对象
     */
    async create(createVO: CreateProject): GoAsync<Project> {
        // 1. 调用领域层方法
        const [projectEntity, err] = await this.projectDomain.create(createVO)
        if (err !== null) {
            return [null, err]
        }
        // 2. 转换为视图对象
        const project = projectEntity2ViewObject(projectEntity)
        // 3. 存储到状态管理
        this.store.addProject(project)
        return [project, null]
    }

    /**
     * 加载项目偏好
     * @param projectId 项目ID
     * @returns 项目偏好视图对象
     */
    async loadProjectPreference(projectId: Project['id']): GoAsync<void> {
        // 1. 调用领域层方法
        const [preferenceEntity, err] = await this.projectDomain.getPreference(projectId)
        if (err !== null) {
            return err
        }
        // 2. 转换为视图对象
        const preference = projectPreferenceEntity2ProjectPreferenceVO(preferenceEntity)
        preference.projectId = projectId
        preference.getTasksOptions.projectId = projectId
        // 3. 存储到状态管理
        this.store.setProjectPreference(preference)
        // console.log('loadProjectPreference', preference)
        // 4. 返回
        return null
    }

    /**
     * 保存标签偏好
     * @param projectId 项目ID
     * @param newPreference 项目偏好视图对象
     * @returns 错误信息
     */
    async savePreference(
        projectId: Project['id'],
        newPreference: ProjectPreference
    ): GoAsync<void> {
        // 1. 判断项目偏好是否存在
        if (!newPreference) {
            return new Error('项目偏好无效')
        }
        // 2. 存储项目偏好实体
        const preferenceEntity = projectPreferenceVO2Entity(newPreference)
        const [, err] = await this.projectDomain.updatePreference(projectId, preferenceEntity)
        return err
    }

    /**
     * 删除项目
     * @param projectId 项目ID
     * @returns 无
     */
    async delete(projectId: Project['id']): GoAsync<void> {
        // 1. 询问用户是否确认删除
        const [isByCancel] = await NueConfirm({
            title: '确认删除项目',
            content: '删除项目后可以在 项目管理 中恢复。是否继续？',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        })
        // 2. 判断用户是否取消删除
        if (isByCancel) {
            return null
        }
        // 3. 调用领域层方法
        return await this.projectDomain.remove(projectId)
    }

    /**
     * 归档项目
     * @param projectId 项目ID
     * @returns 无
     */
    async archive(projectId: Project['id']): GoAsync<void> {
        // 1. 获取项目名称
        const projectName = this.store.getProject(projectId)?.name
        // 1. 询问用户是否确认删除
        const [isByCancel] = await NueConfirm({
            title: '确认归档项目',
            content: `确认归档项目 ${projectName} 吗？`,
            confirmButtonText: '归档',
            cancelButtonText: '取消'
        })
        // 2. 判断用户是否取消删除
        if (isByCancel) {
            return null
        }
        // 3. 调用领域层方法
        return await this.projectDomain.archive(projectId)
    }
}
