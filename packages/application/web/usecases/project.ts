import type { CreateProject, GoAsync, Project } from '@nao-todo/types'
import { ProjectDomain } from '@nao-todo/domain/project/services'
import { projectEntity2ViewObject } from '../converters/project'

export interface ProjectStore {
    setProjects: (projects: Project[]) => void
    addProject: (project: Project) => void
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
}
