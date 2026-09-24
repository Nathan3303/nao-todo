import { TASK_PRIORITIES, TASK_STATES } from '@nao-todo/domain-task'
import type { SearchQueryState } from './search-query'

/**
 * 常用搜索（SEA-05）
 * @description localStorage 持久化具名搜索条件：≤20 条、允许重名、顺序即展示序。
 *              纯函数 + 可注入 Storage（便于单测与降级）；读写一律 try/catch 容错
 *              （禁用/损坏/不可用时降级为无列表，不阻断搜索）。
 */

/** 存储键（与关键词历史 naotodo.search.history 并存，不合并） */
export const SAVED_SEARCH_STORAGE_KEY = 'naotodo.search.saved'

/** 条数上限 */
export const SAVED_SEARCH_MAX = 20

/** 常用搜索条目 */
export type SavedSearch = {
    id: string
    name: string
    query: SearchQueryState
    createdAt: string
}

/** 可注入的存储最小接口（默认全局 localStorage） */
export type SavedSearchStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 解析存储：显式传入（含 null=不可用）；未传则取全局 localStorage */
const resolveStorage = (storage?: SavedSearchStorage | null): SavedSearchStorage | null => {
    if (storage !== undefined) return storage
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

/** 字符串数组归一（非字符串项丢弃） */
const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** 去重并保序 */
const dedupe = (values: string[]): string[] => [...new Set(values)]

/** 枚举白名单判定 */
const isPriority = (value: string): boolean =>
    (TASK_PRIORITIES as readonly string[]).includes(value)
const isState = (value: string): boolean => (TASK_STATES as readonly string[]).includes(value)

/** 查询条件归一（非法值清洗：枚举过滤 / 数组去重 / 布尔化） */
const normalizeQuery = (raw: unknown): SearchQueryState => {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    return {
        keyword: typeof source.keyword === 'string' ? source.keyword : '',
        projectIds: dedupe(toStringArray(source.projectIds)),
        tagIds: dedupe(toStringArray(source.tagIds)),
        priorities: dedupe(toStringArray(source.priorities).filter(isPriority)),
        states: dedupe(toStringArray(source.states).filter(isState)),
        includeExcluded: source.includeExcluded === true,
        includeArchived: source.includeArchived === true
    }
}

/** 单条归一（缺 id/name 视为损坏，丢弃） */
const normalizeSavedSearch = (raw: unknown): SavedSearch | null => {
    if (!raw || typeof raw !== 'object') return null
    const source = raw as Record<string, unknown>
    const id = typeof source.id === 'string' ? source.id.trim() : ''
    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (id === '' || name === '') return null
    return {
        id,
        name,
        query: normalizeQuery(source.query),
        createdAt: typeof source.createdAt === 'string' ? source.createdAt : ''
    }
}

/**
 * 读取常用搜索（损坏/非法数据一律忽略；不抛错）
 * @param storage 可注入存储；传 null 表示存储不可用
 */
export const readSavedSearches = (storage?: SavedSearchStorage | null): SavedSearch[] => {
    const target = resolveStorage(storage)
    if (!target) return []
    try {
        const raw = target.getItem(SAVED_SEARCH_STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        const seen = new Set<string>()
        const result: SavedSearch[] = []
        for (const item of parsed) {
            const saved = normalizeSavedSearch(item)
            if (!saved || seen.has(saved.id)) continue
            seen.add(saved.id)
            result.push(saved)
            if (result.length >= SAVED_SEARCH_MAX) break
        }
        return result
    } catch {
        return []
    }
}

/** 写入常用搜索（失败静默；截断至上限） */
const writeSavedSearches = (list: SavedSearch[], storage?: SavedSearchStorage | null): void => {
    const target = resolveStorage(storage)
    if (!target) return
    try {
        target.setItem(SAVED_SEARCH_STORAGE_KEY, JSON.stringify(list.slice(0, SAVED_SEARCH_MAX)))
    } catch {
        /* 存储不可用：降级为无列表 */
    }
}

/** 生成条目 ID（crypto.randomUUID 优先，降级时间戳+随机） */
const createId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
    } catch {
        /* 忽略：走降级 */
    }
    return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 新增常用搜索（空名忽略；已达上限不新增）
 * @param input 名称 + 查询条件
 * @returns 最新列表（存储不可用时为 []）
 */
export const addSavedSearch = (
    input: { name: string; query: SearchQueryState },
    storage?: SavedSearchStorage | null
): SavedSearch[] => {
    const name = input.name.trim()
    if (name === '') return readSavedSearches(storage)
    const current = readSavedSearches(storage)
    if (current.length >= SAVED_SEARCH_MAX) return current
    const next: SavedSearch[] = [
        ...current,
        {
            id: createId(),
            name,
            query: normalizeQuery(input.query),
            createdAt: new Date().toISOString()
        }
    ]
    writeSavedSearches(next, storage)
    return readSavedSearches(storage)
}

/**
 * 删除单条（按 id）
 * @returns 删除后的最新列表
 */
export const removeSavedSearch = (
    id: SavedSearch['id'],
    storage?: SavedSearchStorage | null
): SavedSearch[] => {
    const next = readSavedSearches(storage).filter((item) => item.id !== id)
    writeSavedSearches(next, storage)
    return next
}

/**
 * 重命名（空名忽略）
 * @returns 重命名后的最新列表
 */
export const renameSavedSearch = (
    id: SavedSearch['id'],
    name: string,
    storage?: SavedSearchStorage | null
): SavedSearch[] => {
    const trimmed = name.trim()
    if (trimmed === '') return readSavedSearches(storage)
    const next = readSavedSearches(storage).map((item) =>
        item.id === id ? { ...item, name: trimmed } : item
    )
    writeSavedSearches(next, storage)
    return next
}

/**
 * 拖拽排序（按下标移动；越界/原地返回原列表）
 * @returns 排序后的最新列表
 */
export const reorderSavedSearches = (
    fromIndex: number,
    toIndex: number,
    storage?: SavedSearchStorage | null
): SavedSearch[] => {
    const current = readSavedSearches(storage)
    if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length ||
        fromIndex === toIndex
    ) {
        return current
    }
    const next = [...current]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return current
    next.splice(toIndex, 0, moved)
    writeSavedSearches(next, storage)
    return next
}

/** 自动命名上下文（名称/文案解析由调用方注入，保持纯函数可测） */
export type SavedSearchNameContext = {
    projectNameOf: (projectId: string) => string | undefined
    tagNameOf: (tagId: string) => string | undefined
    priorityLabelOf: (priority: string) => string | undefined
    stateLabelOf: (state: string) => string | undefined
    /** 无任何条件时的兜底名 */
    fallback: string
}

/**
 * 由查询条件派生默认名称
 * @description 按「关键词 · 清单 · 标签 · 优先级 · 状态」顺序以 ` · ` 拼接（组内以 `、` 连接）；
 *              无条件时返回 `context.fallback`。默认名可改。
 */
export const deriveSavedSearchName = (
    query: SearchQueryState,
    context: SavedSearchNameContext
): string => {
    const parts: string[] = []
    const keyword = query.keyword.trim()
    if (keyword !== '') parts.push(keyword)
    const resolveGroup = (ids: string[], resolve: (id: string) => string | undefined) => {
        const names = ids.map((id) => resolve(id)).filter((name): name is string => Boolean(name))
        if (names.length > 0) parts.push(names.join('、'))
    }
    resolveGroup(query.projectIds, context.projectNameOf)
    resolveGroup(query.tagIds, context.tagNameOf)
    resolveGroup(query.priorities, context.priorityLabelOf)
    resolveGroup(query.states, context.stateLabelOf)
    return parts.join(' · ') || context.fallback
}