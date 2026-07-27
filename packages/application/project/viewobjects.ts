import type {
    NullableDateString,
    NullableString,
    ViewObjectBase,
    GetTasksOptions,
    TaskColumnOptions
} from '@nao-todo/shared'

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

// 项目视图对象
export type ProjectViewObject = ViewObjectBase & {
    // userId: string
    icon: string
    name: string
    description: NullableString
    archivedAt: NullableDateString
    deactivedAt: NullableDateString
    sortId: number
    // -- Others
    isArchived: boolean
    isDeleted: boolean
    createTaskOptions?: { projectId: string }
}

// 创建项目视图对象
export type CreateProjectViewObject = {
    icon: string
    name: string
    description?: NullableString
}

// 更新项目视图对象
export type UpdateProjectViewObject = {
    // id: ProjectViewObject['id']
    icon?: string
    name?: string
    description?: NullableString
    archivedAt?: NullableDateString
    sortId?: number
}

// 项目偏好视图对象
export type ProjectPreferenceViewObject = ViewObjectBase & {
    // userId: string
    projectId: string
    viewType: string
    getTasksOptions: Partial<GetTasksOptions>
    columns: TaskColumnOptions
}