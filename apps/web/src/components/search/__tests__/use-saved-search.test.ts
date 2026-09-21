// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useSavedSearch } from '../use-saved-search'
import { SAVED_SEARCH_MAX } from '../saved-search'
import type { SearchQueryState } from '../search-query'

/**
 * SEA-05：常用搜索组合式（响应式列表 + 新增上限 + 增删改序 + 存储降级）
 */

const EMPTY_QUERY: SearchQueryState = {
    keyword: '',
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: [],
    includeExcluded: false
}

beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
})

describe('useSavedSearch', () => {
    it('新增成功 ⇒ ok，列表新增一条', () => {
        const { savedSearches, add } = useSavedSearch()
        expect(add('甲', EMPTY_QUERY)).toBe('ok')
        expect(savedSearches.value).toHaveLength(1)
        expect(savedSearches.value[0]!.name).toBe('甲')
    })

    it('达到上限 ⇒ full，列表不再增长', () => {
        const { savedSearches, add } = useSavedSearch()
        for (let i = 0; i < SAVED_SEARCH_MAX; i++) add(`n${i}`, EMPTY_QUERY)
        expect(savedSearches.value).toHaveLength(SAVED_SEARCH_MAX)
        expect(add('over', EMPTY_QUERY)).toBe('full')
        expect(savedSearches.value).toHaveLength(SAVED_SEARCH_MAX)
    })

    it('删除 / 重命名 / 排序同步更新列表', () => {
        const { savedSearches, add, remove, rename, reorder } = useSavedSearch()
        add('a', EMPTY_QUERY)
        add('b', EMPTY_QUERY)
        add('c', EMPTY_QUERY)
        const [a, , c] = savedSearches.value

        rename(a!.id, 'A')
        expect(savedSearches.value[0]!.name).toBe('A')

        reorder(0, 2)
        expect(savedSearches.value.map((item) => item.name)).toEqual(['b', 'c', 'A'])

        remove(c!.id)
        expect(savedSearches.value.some((item) => item.id === c!.id)).toBe(false)
    })

    it('存储不可用 ⇒ add 返回 unavailable，列表为空（静默降级）', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage unavailable')
        })
        const { savedSearches, add } = useSavedSearch()
        expect(add('甲', EMPTY_QUERY)).toBe('unavailable')
        expect(savedSearches.value).toEqual([])
    })
})