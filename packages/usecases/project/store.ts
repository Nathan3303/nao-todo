import {
    ProjectPreferenceViewObject,
    ProjectViewObject,
    UpdateProjectViewObject
} from './viewobjects'

/**
 * 项目状态管理
 */
export interface ProjectStore {
    /**
     * 设置项目列表
     * @param projects 项目列表
     */
    setProjects: (projects: ProjectViewObject[]) => void

    /**
     * 添加项目
     * @param project 项目
     */
    addProject: (project: ProjectViewObject) => void

    /**
     * 设置项目偏好
     * @param preference 项目偏好
     */
    setProjectPreference: (preference: ProjectPreferenceViewObject) => void

    /**
     * 获取项目
     * @param projectId 项目ID
     * @returns 项目或void
     */
    getProject: (projectId: ProjectViewObject['id']) => ProjectViewObject | void

    /**
     * 获取所有项目
     * @returns 所有项目
     */
    getAllProjects: () => ProjectViewObject[]

    /**
     * 删除项目
     * @param projectId 项目ID
     */
    deleteProject: (projectId: ProjectViewObject['id']) => void

    /**
     * 软删除项目
     * @param projectId 项目ID
     */
    softDeleteProject: (projectId: ProjectViewObject['id']) => void

    /**
     * 恢复项目
     * @param projectId 项目ID
     */
    restoreProject: (projectId: ProjectViewObject['id']) => void

    /**
     * 更新项目
     * @param projectId 项目ID
     * @param updateProjectViewObject 更新项目视图对象
     */
    updateProject: (
        projectId: ProjectViewObject['id'],
        updateProjectViewObject: UpdateProjectViewObject
    ) => void

    /**
     * 更新项目列表
     * @param newProjects 新项目列表
     */
    updateProjects: (newProjects: ProjectViewObject[]) => void
}

