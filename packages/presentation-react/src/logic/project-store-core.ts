import type {
    ProjectPreferenceViewObject,
    ProjectStore,
    ProjectViewObject,
    UpdateProjectViewObject
} from '@nao-todo/domain-project'
import type { GetTasksOptions, TaskColumnOptions } from '@nao-todo/shared/constants/task'

/** 默认列配置（与 Web 端 defaultColumns 对齐） */
const DEFAULT_COLUMNS: TaskColumnOptions = {
    name: true,
    description: false,
    state: true,
    priority: true,
    startAt: false,
    endAt: true,
    project: true,
    tags: true,
    givenUpAt: false,
    starMarkAt: false,
    archivedAt: false,
    createdAt: false,
    updatedAt: true,
    deletedAt: false
}

/**
 * 项目 store core（订阅式）
 * @description 实现 domain-project 的 ProjectStore 接口；偏好为内存态（Mobile MVP 不做持久化，
 *              由 usecase loadProjectPreference 从后端拉取后写入）。
 */
export class ProjectStoreCore implements ProjectStore {
    private projectMap = new Map<string, ProjectViewObject>()
    private preference: ProjectPreferenceViewObject | undefined
    private listeners = new Set<() => void>()
    // 快照缓存（useSyncExternalStore 要求 getSnapshot 返回稳定引用）
    private projectsSnapshot: ProjectViewObject[] = []

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.projectsSnapshot = [...this.projectMap.values()]
        this.listeners.forEach((listener) => listener())
    }

    // --- 快照读取（供 useSyncExternalStore） ---

    getProjectsSnapshot = (): ProjectViewObject[] => this.projectsSnapshot

    get projects(): ProjectViewObject[] {
        return this.projectsSnapshot
    }

    getAllProjects = (): ProjectViewObject[] => this.projectsSnapshot

    setProjects = (projects: ProjectViewObject[]): void => {
        this.projectMap = new Map(projects.map((project) => [project.id, project]))
        this.notify()
    }

    addProject = (project: ProjectViewObject): void => {
        this.projectMap.set(project.id, project)
        this.notify()
    }

    getProject = (id: string): ProjectViewObject | undefined => this.projectMap.get(id)

    updateProjects = (projects: ProjectViewObject[]): void => {
        for (const project of projects) this.projectMap.set(project.id, project)
        this.notify()
    }

    softDeleteProject = (id: string): void => {
        const current = this.projectMap.get(id)
        if (!current) return
        this.projectMap.set(id, {
            ...current,
            isDeleted: true,
            deletedAt: new Date().toISOString()
        })
        this.notify()
    }

    deleteProject = (id: string): void => {
        this.projectMap.delete(id)
        this.notify()
    }

    restoreProject = (id: string): void => {
        const current = this.projectMap.get(id)
        if (!current) return
        this.projectMap.set(id, { ...current, isDeleted: false, deletedAt: null })
        this.notify()
    }

    updateProject = (id: string, update: Partial<UpdateProjectViewObject>): void => {
        const current = this.projectMap.get(id)
        if (!current) return
        this.projectMap.set(id, { ...current, ...update })
        this.notify()
    }

    get projectPreference(): ProjectPreferenceViewObject | undefined {
        return this.preference
    }

    setProjectPreference = (preference: ProjectPreferenceViewObject): void => {
        this.preference = preference
        this.notify()
    }

    getProjectPreference = (): ProjectPreferenceViewObject | undefined => this.preference

    updatePreferenceColumns = (key: keyof TaskColumnOptions, value: boolean): void => {
        if (!this.preference) return
        this.preference = {
            ...this.preference,
            columns: { ...this.preference.columns, [key]: value }
        }
        this.notify()
    }

    updatePreferenceGetTasksOptions = <T extends keyof GetTasksOptions>(
        key: T,
        value: GetTasksOptions[T]
    ): void => {
        if (!this.preference) return
        this.preference = {
            ...this.preference,
            getTasksOptions: { ...this.preference.getTasksOptions, [key]: value }
        }
        this.notify()
    }

    getPreferenceGetTasksOption = <T extends keyof GetTasksOptions>(key: T): GetTasksOptions[T] =>
        this.preference?.getTasksOptions[key] as GetTasksOptions[T]

    getPreferenceGetTasksOptions = (): GetTasksOptions =>
        this.preference?.getTasksOptions ?? ({} as GetTasksOptions)

    /** 默认列（供 UI 无偏好时兜底展示） */
    static get defaultColumns(): TaskColumnOptions {
        return { ...DEFAULT_COLUMNS }
    }
}