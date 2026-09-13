import { describe, expect, it } from 'vite-plus/test'
import {
    addSearchHistory,
    clearSearchHistory,
    readSearchHistory,
    removeSearchHistory,
    SEARCH_HISTORY_MAX,
    SEARCH_HISTORY_STORAGE_KEY,
    type SearchHistoryStorage
} from '../search-history'

/**
 * SEA-04 / S6：搜索历史纯层（localStorage 容错、去重、上限、清除）
 */

/** 内存版 Storage（含读写计数，便于断言写入行为） */
const makeMemoryStorage = (): SearchHistoryStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {}
    return {
        data,
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => {
            data[key] = value
        }
    }
}

/** 抛错版 Storage（模拟禁用/配额异常） */
const makeBrokenStorage = (): SearchHistoryStorage => ({
    getItem: () => {
        throw new Error('storage unavailable')
    },
    setItem: () => {
        throw new Error('storage unavailable')
    }
})

describe('search-history - 记录与去重', () => {
    it('记录并按最近优先置顶；空词不记录', () => {
        const storage = makeMemoryStorage()
        expect(addSearchHistory('买菜', storage)).toEqual(['买菜'])
        expect(addSearchHistory('周报', storage)).toEqual(['周报', '买菜'])
        expect(addSearchHistory('   ', storage)).toEqual(['周报', '买菜'])
    })

    it('大小写不敏感去重 + trim', () => {
        const storage = makeMemoryStorage()
        addSearchHistory('Review', storage)
        addSearchHistory('  REVIEW ', storage)
        expect(readSearchHistory(storage)).toEqual(['REVIEW'])
    })

    it(`上限 ${SEARCH_HISTORY_MAX} 条，超出淘汰最旧`, () => {
        const storage = makeMemoryStorage()
        for (let i = 0; i < SEARCH_HISTORY_MAX + 5; i++) addSearchHistory(`kw${i}`, storage)
        const history = readSearchHistory(storage)
        expect(history).toHaveLength(SEARCH_HISTORY_MAX)
        expect(history[0]).toBe(`kw${SEARCH_HISTORY_MAX + 4}`)
        expect(history).not.toContain('kw0')
    })
})

describe('search-history - 清除', () => {
    it('单条移除（大小写不敏感）+ 全部清除', () => {
        const storage = makeMemoryStorage()
        addSearchHistory('买菜', storage)
        addSearchHistory('周报', storage)
        expect(removeSearchHistory('周报', storage)).toEqual(['买菜'])
        expect(readSearchHistory(storage)).toEqual(['买菜'])
        expect(clearSearchHistory(storage)).toEqual([])
        expect(readSearchHistory(storage)).toEqual([])
    })
})

describe('search-history - 容错与降级（AC9）', () => {
    it('存储抛错：读写降级为无历史，不抛错', () => {
        const storage = makeBrokenStorage()
        expect(readSearchHistory(storage)).toEqual([])
        expect(addSearchHistory('买菜', storage)).toEqual([])
        expect(removeSearchHistory('买菜', storage)).toEqual([])
        expect(clearSearchHistory(storage)).toEqual([])
    })

    it('storage=null（不可用）降级为无历史', () => {
        expect(readSearchHistory(null)).toEqual([])
        expect(addSearchHistory('买菜', null)).toEqual([])
    })

    it('损坏 JSON / 非数组 / 非法元素被忽略', () => {
        const storage = makeMemoryStorage()
        storage.data[SEARCH_HISTORY_STORAGE_KEY] = '{not json'
        expect(readSearchHistory(storage)).toEqual([])
        storage.data[SEARCH_HISTORY_STORAGE_KEY] = '{"a":1}'
        expect(readSearchHistory(storage)).toEqual([])
        storage.data[SEARCH_HISTORY_STORAGE_KEY] = JSON.stringify(['a', 1, null, '  ', 'b', 'A'])
        expect(readSearchHistory(storage)).toEqual(['a', 'b'])
    })
})