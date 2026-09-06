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