import { describe, expect, it } from 'vite-plus/test'
import {
    addSavedSearch,
    deriveSavedSearchName,
    readSavedSearches,
    removeSavedSearch,
    renameSavedSearch,
    reorderSavedSearches,
    SAVED_SEARCH_MAX,
    SAVED_SEARCH_STORAGE_KEY,
    type SavedSearchNameContext,
    type SavedSearchStorage
} from '../saved-search'
import type { SearchQueryState } from '../search-query'

/**
 * SEA-05：常用搜索纯层（localStorage 容错、上限、增删改序、自动命名）
 */

const EMPTY_QUERY: SearchQueryState = {
    keyword: '',
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: [],
    includeExcluded: false
}

const makeQuery = (overrides: Partial<SearchQueryState> = {}): SearchQueryState => ({
    ...EMPTY_QUERY,
    ...overrides
})

/** 内存版 Storage */
const makeMemoryStorage = (): SavedSearchStorage & { data: Record<string, string> } => {
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
const makeBrokenStorage = (): SavedSearchStorage => ({
    getItem: () => {
        throw new Error('storage unavailable')
    },
    setItem: () => {
        throw new Error('storage unavailable')
    }
})

const nameContext = (overrides: Partial<SavedSearchNameContext> = {}): SavedSearchNameContext => ({
    projectNameOf: (id) => (id === 'p1' ? '工作' : undefined),
    tagNameOf: (id) => (id === 't1' ? '重要' : undefined),
    priorityLabelOf: (value) => (value === 'high' ? '高优先级' : undefined),
    stateLabelOf: (value) => (value === 'in-progress' ? '进行中' : undefined),
    fallback: '常用搜索',
    ...overrides
})

describe('saved-search - 新增与读取', () => {
    it('新增后可读回：id 非空、名称 trim、查询条件归一', () => {
        const storage = makeMemoryStorage()
        const list = addSavedSearch(
            { name: '  甲  ', query: makeQuery({ keyword: '报告', priorities: ['high'] }) },
            storage
        )
        expect(list).toHaveLength(1)
        expect(list[0]!.id).not.toBe('')
        expect(list[0]!.name).toBe('甲')
        expect(list[0]!.query).toEqual(makeQuery({ keyword: '报告', priorities: ['high'] }))
        expect(readSavedSearches(storage)).toEqual(list)
    })

    it('允许重名多条（1B）：不去重', () => {
        const storage = makeMemoryStorage()
        addSavedSearch({ name: '同名', query: makeQuery() }, storage)
        const list = addSavedSearch({ name: '同名', query: makeQuery() }, storage)
        expect(list).toHaveLength(2)
        expect(list[0]!.id).not.toBe(list[1]!.id)
    })

    it('空名忽略（不新增）', () => {
        const storage = makeMemoryStorage()
        expect(addSavedSearch({ name: '   ', query: makeQuery() }, storage)).toEqual([])
    })

    it(`上限 ${SAVED_SEARCH_MAX} 条，超出不新增`, () => {
        const storage = makeMemoryStorage()
        for (let i = 0; i < SAVED_SEARCH_MAX + 5; i++) {
            addSavedSearch({ name: `n${i}`, query: makeQuery() }, storage)
        }
        const list = readSavedSearches(storage)
        expect(list).toHaveLength(SAVED_SEARCH_MAX)
        expect(list.at(-1)!.name).toBe(`n${SAVED_SEARCH_MAX - 1}`)
    })
})

describe('saved-search - 删除 / 重命名 / 排序', () => {
    it('按 id 删除', () => {
        const storage = makeMemoryStorage()
        const list = addSavedSearch({ name: 'a', query: makeQuery() }, storage)
        addSavedSearch({ name: 'b', query: makeQuery() }, storage)
        const after = removeSavedSearch(list[0]!.id, storage)
        expect(after.map((item) => item.name)).toEqual(['b'])
    })

    it('重命名 trim；空名忽略', () => {
        const storage = makeMemoryStorage()
        const list = addSavedSearch({ name: 'a', query: makeQuery() }, storage)
        const id = list[0]!.id
        expect(renameSavedSearch(id, '  新名  ', storage)[0]!.name).toBe('新名')
        expect(renameSavedSearch(id, '   ', storage)[0]!.name).toBe('新名')
    })

    it('拖拽排序按下标移动；越界/原地不变', () => {
        const storage = makeMemoryStorage()
        ;['a', 'b', 'c'].forEach((name) => addSavedSearch({ name, query: makeQuery() }, storage))
        expect(reorderSavedSearches(0, 2, storage).map((item) => item.name)).toEqual([
            'b',
            'c',
            'a'
        ])
        expect(reorderSavedSearches(0, 0, storage).map((item) => item.name)).toEqual([
            'b',
            'c',
            'a'
        ])
        expect(reorderSavedSearches(0, 9, storage).map((item) => item.name)).toEqual([
            'b',
            'c',
            'a'
        ])
    })
})

describe('saved-search - 自动命名', () => {
    it('仅关键词 ⇒ 关键词', () => {
        expect(deriveSavedSearchName(makeQuery({ keyword: '周报' }), nameContext())).toBe('周报')
    })

    it('优先级 + 状态 ⇒ 以 ` · ` 拼接', () => {
        expect(
            deriveSavedSearchName(
                makeQuery({ priorities: ['high'], states: ['in-progress'] }),
                nameContext()
            )
        ).toBe('高优先级 · 进行中')
    })

    it('含清单/标签名（组内以 `、` 连接）', () => {
        expect(
            deriveSavedSearchName(
                makeQuery({ projectIds: ['p1'], tagIds: ['t1'], keyword: '报告' }),
                nameContext()
            )
        ).toBe('报告 · 工作 · 重要')
    })

    it('无条件 ⇒ 兜底名', () => {
        expect(deriveSavedSearchName(makeQuery(), nameContext())).toBe('常用搜索')
    })
})

describe('saved-search - 容错与降级', () => {
    it('非法 JSON / 非数组 ⇒ 空列表', () => {
        const storage = makeMemoryStorage()
        storage.data[SAVED_SEARCH_STORAGE_KEY] = '{ not json'
        expect(readSavedSearches(storage)).toEqual([])
        storage.data[SAVED_SEARCH_STORAGE_KEY] = JSON.stringify({ a: 1 })
        expect(readSavedSearches(storage)).toEqual([])
    })

    it('损坏条目丢弃；非法枚举值过滤；includeExcluded 布尔化', () => {
        const storage = makeMemoryStorage()
        storage.data[SAVED_SEARCH_STORAGE_KEY] = JSON.stringify([
            { id: '1', name: 'ok', query: { keyword: 'k' }, createdAt: 't' },
            { id: '', name: 'bad-id', query: {} },
            { name: 'bad-no-id', query: {} },
            'not-an-object',
            {
                id: '2',
                name: 'filtered',
                query: {
                    priorities: ['high', 'bogus'],
                    states: ['done', 'nope'],
                    includeExcluded: 'yes'
                },
                createdAt: 't'
            }
        ])
        const list = readSavedSearches(storage)
        expect(list.map((item) => item.id)).toEqual(['1', '2'])
        expect(list[0]!.query).toEqual(makeQuery({ keyword: 'k' }))
        expect(list[1]!.query.priorities).toEqual(['high'])
        expect(list[1]!.query.states).toEqual(['done'])
        expect(list[1]!.query.includeExcluded).toBe(false)
    })

    it('存储抛错：读写降级为空列表，不抛错', () => {
        const storage = makeBrokenStorage()
        expect(readSavedSearches(storage)).toEqual([])
        expect(addSavedSearch({ name: 'a', query: makeQuery() }, storage)).toEqual([])
        expect(removeSavedSearch('any', storage)).toEqual([])
        expect(renameSavedSearch('any', 'b', storage)).toEqual([])
        expect(reorderSavedSearches(0, 1, storage)).toEqual([])
    })
})