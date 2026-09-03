import type {
    BuiltInProjectPreferenceViewObject,
    BuiltInProjectStore,
    BuiltInProjectViewObject
} from '@nao-todo/domain-built-in-project'
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
 * 内建清单 store core（订阅式）
 * @description 实现 domain-built-in-project 的 BuiltInProjectStore 接口；偏好为内存态（Mobile MVP）。
 */
export class BuiltInProjectStoreCore implements BuiltInProjectStore {
    private projects: BuiltInProjectViewObject[] = []
    private preference: BuiltInProjectPreferenceViewObject | undefined
    private listeners = new Set<() => void>()
    // 快照缓存（useSyncExternalStore 要求 getSnapshot 返回稳定引用）
    private projectsSnapshot: BuiltInProjectViewObject[] = []

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.projectsSnapshot = [...this.projects]
        this.listeners.forEach((listener) => listener())
    }

    // --- 快照读取（供 useSyncExternalStore） ---

    getBuiltInProjectsSnapshot = (): BuiltInProjectViewObject[] => this.projectsSnapshot

    get builtInProjects(): BuiltInProjectViewObject[] {
        return this.projectsSnapshot
    }
    getBuiltInProject = (id: string): BuiltInProjectViewObject | undefined =>
        this.projects.find((project) => project.id === id)

    setBuiltInProjects = (projects: BuiltInProjectViewObject[]): void => {
        this.projects = projects
        this.notify()
    }

    setBuiltInProjectPreference = (preference: BuiltInProjectPreferenceViewObject): void => {
        this.preference = preference
        this.notify()
    }

    getBuiltInProjectPreference = (): BuiltInProjectPreferenceViewObject | undefined =>
        this.preference

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