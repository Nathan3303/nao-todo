import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared/constants/task'
import type {
    ProjectViewObject,
    UpdateProjectViewObject,
    ProjectPreferenceViewObject
} from './viewobjects'

// 项目存储接口
export type ProjectStore = {
    projects: ProjectViewObject[]
    getAllProjects: () => ProjectViewObject[]
    setProjects: (projects: ProjectViewObject[]) => void
    addProject: (project: ProjectViewObject) => void
    getProject: (id: string) => ProjectViewObject | undefined
    updateProjects: (projects: ProjectViewObject[]) => void
    softDeleteProject: (id: string) => void
    deleteProject: (id: string) => void
    restoreProject: (id: string) => void
    /**
     * 归档项目（可选：本地优先端在 store 内置归档态收敛）
     * @description 可选方法 ⇒ 远端/mobile 存储实现不必实现；调用方以 `?.` 守卫。
     */
    archiveProject?: (id: string) => void
    /** 取消归档项目（可选，同 `archiveProject`） */
    unarchiveProject?: (id: string) => void
    updateProject: (id: string, update: Partial<UpdateProjectViewObject>) => void
    projectPreference: ProjectPreferenceViewObject | undefined
    setProjectPreference: (preference: ProjectPreferenceViewObject) => void
    getProjectPreference: () => ProjectPreferenceViewObject | undefined
    updatePreferenceColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updatePreferenceGetTasksOptions: <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ) => void
    getPreferenceGetTasksOption: <T extends keyof GetTasksOptions>(key: T) => GetTasksOptions[T]
    getPreferenceGetTasksOptions: () => GetTasksOptions
}