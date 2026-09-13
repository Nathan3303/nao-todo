/**
 * 搜索历史（SEA-04 / S6）
 * @description localStorage 持久化最近关键词：≤10、大小写不敏感去重、trim、最近优先。
 *              纯函数 + 可注入 Storage（便于单测与降级）；读写一律 try/catch 容错
 *              （禁用/损坏/不可用时降级为无历史，不阻断搜索）。
 */

/** 存储键 */
export const SEARCH_HISTORY_STORAGE_KEY = 'naotodo.search.history'

/** 历史上限（最近 N 条） */
export const SEARCH_HISTORY_MAX = 10

/** 可注入的存储最小接口（默认全局 localStorage） */
export type SearchHistoryStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 解析存储：显式传入（含 null=不可用）；未传则取全局 localStorage */
const resolveStorage = (storage?: SearchHistoryStorage | null): SearchHistoryStorage | null => {
    if (storage !== undefined) return storage
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

/** 归一化：trim；空串返回 '' */
const normalizeKeyword = (keyword: string): string => keyword.trim()

/** 关键词相等判定（大小写不敏感） */
const isSameKeyword = (a: string, b: string): boolean =>
    a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * 读取历史（损坏/非法数据一律忽略；不抛错）
 * @param storage 可注入存储；传 null 表示存储不可用
 */
export const readSearchHistory = (storage?: SearchHistoryStorage | null): string[] => {
    const target = resolveStorage(storage)
    if (!target) return []
    try {
        const raw = target.getItem(SEARCH_HISTORY_STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        const seen = new Set<string>()
        const result: string[] = []
        for (const item of parsed) {
            if (typeof item !== 'string') continue
            const keyword = normalizeKeyword(item)
            if (keyword === '' || seen.has(keyword.toLowerCase())) continue
            seen.add(keyword.toLowerCase())
            result.push(keyword)
            if (result.length >= SEARCH_HISTORY_MAX) break
        }
        return result
    } catch {
        return []
    }
}

/** 写入历史（失败静默） */
const writeSearchHistory = (history: string[], storage?: SearchHistoryStorage | null): void => {
    const target = resolveStorage(storage)
    if (!target) return
    try {
        target.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history))
    } catch {
        /* 存储不可用：降级为无历史 */
    }
}

/**
 * 记录关键词（去重置顶；空词不记录）
 * @returns 记录后的最新历史
 */
export const addSearchHistory = (
    keyword: string,
    storage?: SearchHistoryStorage | null
): string[] => {
    const normalized = normalizeKeyword(keyword)
    if (normalized === '') return readSearchHistory(storage)
    const next = [
        normalized,
        ...readSearchHistory(storage).filter((item) => !isSameKeyword(item, normalized))
    ].slice(0, SEARCH_HISTORY_MAX)
    writeSearchHistory(next, storage)
    // 存储不可用时写入静默失败 → 以实际持久化结果为准（降级为无历史，S6/AC9）
    return readSearchHistory(storage)
}

/**
 * 移除单条（大小写不敏感）
 * @returns 移除后的最新历史
 */
export const removeSearchHistory = (
    keyword: string,
    storage?: SearchHistoryStorage | null
): string[] => {
    const next = readSearchHistory(storage).filter((item) => !isSameKeyword(item, keyword))
    writeSearchHistory(next, storage)
    return next
}

/**
 * 清空全部
 * @returns 空数组
 */
export const clearSearchHistory = (storage?: SearchHistoryStorage | null): string[] => {
    writeSearchHistory([], storage)
    return []
}