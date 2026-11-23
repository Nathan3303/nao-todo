import { describe, expect, it } from 'vite-plus/test'
import {
    EMPTY_SEARCH_QUERY,
    needsSearchQueryReExport,
    parseSearchQuery,
    searchQueryEquals,
    serializeSearchQuery,
    type SearchQueryState
} from '../search-query'
import {
    addSavedSearch,
    readSavedSearches,
    SAVED_SEARCH_STORAGE_KEY,
    type SavedSearchStorage
} from '../saved-search'
import { DEFAULT_SEARCH_SORT, searchSortEquals } from '../search-sort'

/**
 * T770 · 新状态维度（排序 / 截止日区间 / 含无截止日）的 URL 与保存搜索兼容
 * 口径（需求 4）：新字段**全部可选**；旧 URL、旧保存搜索缺字段 ⇒ 走默认值，
 *                不崩、不静默改写用户已保存的条件语义。
 */

/** 最小内存 storage（与既有 saved-search 用例同法） */
const makeStorage = (initial?: Record<string, string>): SavedSearchStorage => {
    const data = new Map(Object.entries(initial ?? {}))
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
            data.set(key, value)
        }
    }
}

describe('T770 URL：新维度编解码（缺省不留痕）', () => {
    it('空 query 仍是空状态（新字段不默认写入）', () => {
        expect(parseSearchQuery({})).toEqual(EMPTY_SEARCH_QUERY)
        expect(serializeSearchQuery(EMPTY_SEARCH_QUERY)).toEqual({})
    })

    it('sort / dueFrom / dueTo / noDue 往返一致', () => {
        const raw = {
            q: '买菜',
            sort: 'name:asc',
            dueFrom: '2026-03-01',
            dueTo: '2026-03-31',
            noDue: '1'
        }
        const state = parseSearchQuery(raw)
        expect(state.sort).toEqual({ field: 'name', order: 'asc' })
        expect(state.dueFrom).toBe('2026-03-01')
        expect(state.dueTo).toBe('2026-03-31')
        expect(state.includeNoDue).toBe(true)
        expect(serializeSearchQuery(state)).toEqual({
            q: '买菜',
            sort: 'name:asc',
            dueFrom: '2026-03-01',
            dueTo: '2026-03-31',
            noDue: '1'
        })
    })

    it('默认排序 token 视为缺省（URL 不留痕迹，旧链接仍干净）', () => {
        const state = parseSearchQuery({ sort: 'relevance:desc' })
        expect(state.sort).toBeUndefined()
        expect(state).toEqual(EMPTY_SEARCH_QUERY)
        expect(serializeSearchQuery({ ...EMPTY_SEARCH_QUERY, sort: DEFAULT_SEARCH_SORT })).toEqual(
            {}
        )
    })

    it('非法 sort token / 非法日期被忽略（不崩、不产生脏值）', () => {
        expect(parseSearchQuery({ sort: 'name' }).sort).toBeUndefined()
        expect(parseSearchQuery({ sort: 'bogus:asc' }).sort).toBeUndefined()
        expect(parseSearchQuery({ sort: 'name:up' }).sort).toBeUndefined()
        expect(parseSearchQuery({ sort: ':asc' }).sort).toBeUndefined()
        expect(parseSearchQuery({ dueFrom: '2026/03/01' }).dueFrom).toBeUndefined()
        expect(parseSearchQuery({ dueTo: 'not-a-date' }).dueTo).toBeUndefined()
        expect(parseSearchQuery({ noDue: '0' }).includeNoDue).toBeUndefined()
    })

    it('单边区间同样往返（另一侧省略）', () => {
        const state = parseSearchQuery({ dueTo: '2026-03-31' })
        expect(state.dueFrom).toBeUndefined()
        expect(serializeSearchQuery(state)).toEqual({ dueTo: '2026-03-31' })
    })
})

describe('T770 URL：等价判定不产生 replace 回环', () => {
    const base: SearchQueryState = { ...EMPTY_SEARCH_QUERY }

    it('缺省 sort（undefined）与显式默认排序等价', () => {
        expect(searchSortEquals(undefined, DEFAULT_SEARCH_SORT)).toBe(true)
        expect(searchQueryEquals(base, { ...base, sort: DEFAULT_SEARCH_SORT })).toBe(true)
    })

    it('仅默认值时无需再导出（旧链接不会因新字段被迫改写）', () => {
        expect(needsSearchQueryReExport(base, {})).toBe(false)
        expect(needsSearchQueryReExport({ ...base, sort: DEFAULT_SEARCH_SORT }, {})).toBe(false)
    })

    it('非默认值差异必须导出；往返后收敛', () => {
        const withSort: SearchQueryState = { ...base, sort: { field: 'name', order: 'asc' } }
        expect(needsSearchQueryReExport(withSort, {})).toBe(true)
        const roundTrip = serializeSearchQuery(withSort)
        expect(needsSearchQueryReExport(withSort, roundTrip)).toBe(false)
    })

    it('截止日/含无截止日差异参与等价判定', () => {
        expect(searchQueryEquals(base, { ...base, dueFrom: '2026-03-01' })).toBe(false)
        expect(searchQueryEquals(base, { ...base, includeNoDue: true })).toBe(false)
        expect(
            searchQueryEquals({ ...base, includeNoDue: true }, { ...base, includeNoDue: true })
        ).toBe(true)
    })
})

describe('T770 保存搜索：旧数据兼容 + 新字段持久化', () => {
    it('旧记录（无新字段）读取不崩，且不注入任何新键（语义不变）', () => {
        const legacy = JSON.stringify([
            {
                id: 'old-1',
                name: '旧搜索',
                query: {
                    keyword: '买菜',
                    projectIds: ['p1'],
                    tagIds: [],
                    priorities: ['high'],
                    states: ['todo'],
                    includeArchived: false
                },
                createdAt: '2026-01-01T00:00:00.000Z'
            }
        ])
        const [item] = readSavedSearches(makeStorage({ [SAVED_SEARCH_STORAGE_KEY]: legacy }))
        expect(item!.query.keyword).toBe('买菜')
        expect(item!.query.projectIds).toEqual(['p1'])
        expect(item!.query.priorities).toEqual(['high'])
        expect(item!.query.sort).toBeUndefined()
        expect(item!.query.dueFrom).toBeUndefined()
        expect(item!.query.includeNoDue).toBeUndefined()
    })

    it('新字段随保存搜索持久化（排序 / 区间 / 含无截止日）', () => {
        const storage = makeStorage()
        const query: SearchQueryState = {
            ...EMPTY_SEARCH_QUERY,
            keyword: '买菜',
            sort: { field: 'dueAt', order: 'desc' },
            dueFrom: '2026-03-01',
            dueTo: '2026-03-31',
            includeNoDue: true
        }
        addSavedSearch({ name: '三月截止', query }, storage)
        const [item] = readSavedSearches(storage)
        expect(item!.query.sort).toEqual({ field: 'dueAt', order: 'desc' })
        expect(item!.query.dueFrom).toBe('2026-03-01')
        expect(item!.query.dueTo).toBe('2026-03-31')
        expect(item!.query.includeNoDue).toBe(true)
    })

    it('损坏/非法新字段被清洗（非法排序被忽略、非法日期被丢弃、布尔化）', () => {
        const corrupted = JSON.stringify([
            {
                id: 'bad-1',
                name: '脏数据',
                query: {
                    keyword: 'x',
                    projectIds: [],
                    tagIds: [],
                    priorities: [],
                    states: [],
                    includeArchived: false,
                    sort: { field: 'bogus', order: 'asc' },
                    dueFrom: '2026/03/01',
                    dueTo: 123,
                    includeNoDue: 'yes'
                },
                createdAt: ''
            }
        ])
        const [item] = readSavedSearches(makeStorage({ [SAVED_SEARCH_STORAGE_KEY]: corrupted }))
        expect(item!.query.sort).toBeUndefined()
        expect(item!.query.dueFrom).toBeUndefined()
        expect(item!.query.dueTo).toBeUndefined()
        expect(item!.query.includeNoDue).toBeUndefined()
        expect(item!.query.keyword).toBe('x')
    })
})