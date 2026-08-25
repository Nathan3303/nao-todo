import type {
    TagPreferenceViewObject,
    TagStore,
    TagViewObject,
    UpdateTagViewObject
} from '@nao-todo/domain-tag'
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
 * 标签 store core（订阅式）
 * @description 实现 domain-tag 的 TagStore 接口；偏好为内存态（Mobile MVP）。
 */
export class TagStoreCore implements TagStore {
    private tagMap = new Map<string, TagViewObject>()
    private preference: TagPreferenceViewObject | undefined
    private listeners = new Set<() => void>()
    // 快照缓存（useSyncExternalStore 要求 getSnapshot 返回稳定引用）
    private tagsSnapshot: TagViewObject[] = []

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify = (): void => {
        this.tagsSnapshot = [...this.tagMap.values()]
        this.listeners.forEach((listener) => listener())
    }

    // --- 快照读取（供 useSyncExternalStore） ---

    getTagsSnapshot = (): TagViewObject[] => this.tagsSnapshot

    get tags(): TagViewObject[] {
        return this.tagsSnapshot
    }

    setTags = (tags: TagViewObject[]): void => {
        this.tagMap = new Map(tags.map((tag) => [tag.id, tag]))
        this.notify()
    }

    addTag = (tag: TagViewObject): void => {
        this.tagMap.set(tag.id, tag)
        this.notify()
    }

    getTag = (id: string): TagViewObject | undefined => this.tagMap.get(id)

    updateTag = (id: string, update: Partial<UpdateTagViewObject>): void => {
        const current = this.tagMap.get(id)
        if (!current) return
        this.tagMap.set(id, { ...current, ...update })
        this.notify()
    }

    updateTags = (tags: TagViewObject[]): void => {
        for (const tag of tags) this.tagMap.set(tag.id, tag)
        this.notify()
    }

    getAllTags = (): TagViewObject[] => this.tagsSnapshot

    deleteTag = (id: string): void => {
        this.tagMap.delete(id)
        this.notify()
    }

    get tagPreference(): TagPreferenceViewObject | undefined {
        return this.preference
    }

    setTagPreference = (preference: TagPreferenceViewObject): void => {
        this.preference = preference
        this.notify()
    }

    getTagPreference = (): TagPreferenceViewObject | undefined => this.preference

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