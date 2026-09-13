import { describe, expect, it } from 'vite-plus/test'
import {
    EMPTY_SEARCH_QUERY,
    needsSearchQueryReExport,
    parseSearchQuery,
    searchQueryEquals,
    serializeSearchQuery,
    type SearchQueryState
} from '../search-query'

/**
 * SEA-04 / S2：搜索 URL 深链编解码（纯函数）
 * @description 覆盖 D1 收件箱哨兵、空值省略、数组 CSV、去重、非法值忽略与往返一致。
 */

describe('parseSearchQuery - URL → 状态', () => {
    it('空 query 归一为空状态（AC9 空 query 不崩溃）', () => {
        expect(parseSearchQuery({})).toEqual(EMPTY_SEARCH_QUERY)
        expect(parseSearchQuery({ q: '', project: '', tag: null, priority: undefined })).toEqual(
            EMPTY_SEARCH_QUERY
        )
    })

    it('q + 四维 CSV 解析', () => {
        const state = parseSearchQuery({
            q: '买菜',
            project: 'p1,p2',
            tag: 't1',
            priority: 'high,medium',
            state: 'todo,in-progress'
        })
        expect(state).toEqual({
            keyword: '买菜',
            projectIds: ['p1', 'p2'],
            tagIds: ['t1'],
            priorities: ['high', 'medium'],
            states: ['todo', 'in-progress'],
            includeExcluded: false
        })
    })

    it('S7b：excluded=1 解析为纳入已删除/已放弃；其他值忽略（AC9）', () => {
        expect(parseSearchQuery({ excluded: '1' }).includeExcluded).toBe(true)
        expect(parseSearchQuery({ excluded: '0' }).includeExcluded).toBe(false)
        expect(parseSearchQuery({ excluded: ['1', '0'] }).includeExcluded).toBe(true)
        expect(parseSearchQuery({ excluded: 'bogus' }).includeExcluded).toBe(false)
    })

    it('D1 收件箱哨兵：inbox token ↔ projectId=""（可与普通清单混排）', () => {
        expect(parseSearchQuery({ project: 'inbox' }).projectIds).toEqual([''])
        expect(parseSearchQuery({ project: 'inbox,p1' }).projectIds).toEqual(['', 'p1'])
        expect(parseSearchQuery({ project: 'p1,inbox' }).projectIds).toEqual(['p1', ''])
    })

    it('去重 + trim + 丢弃空段；数组值先 join（AC9）', () => {
        const state = parseSearchQuery({
            project: ['p1', ' p1 ,,p2 '],
            priority: 'high, high ,bogus',
            state: 'todo,done,done'
        })
        expect(state.projectIds).toEqual(['p1', 'p2'])
        expect(state.priorities).toEqual(['high'])
        expect(state.states).toEqual(['todo', 'done'])
    })

    it('AC9 非法枚举值被忽略（优先级/状态白名单）', () => {
        expect(parseSearchQuery({ priority: 'urgent' }).priorities).toEqual([])
        expect(parseSearchQuery({ state: 'doing' }).states).toEqual([])
        expect(parseSearchQuery({ priority: 'high,urgent', state: 'todo,doing' })).toMatchObject({
            priorities: ['high'],
            states: ['todo']
        })
    })

    it('数组型 q 取首值', () => {
        expect(parseSearchQuery({ q: ['abc', 'def'] }).keyword).toBe('abc')
    })
})

describe('serializeSearchQuery - 状态 → URL', () => {
    it('空值省略（URL 干净）', () => {
        expect(serializeSearchQuery(EMPTY_SEARCH_QUERY)).toEqual({})
        expect(serializeSearchQuery({ ...EMPTY_SEARCH_QUERY, keyword: '   ' })).toEqual({})
    })

    it('四维 CSV 与收件箱哨兵回写 + excluded 开关', () => {
        const state: SearchQueryState = {
            keyword: '买菜',
            projectIds: ['', 'p1'],
            tagIds: ['t1', 't2'],
            priorities: ['high'],
            states: ['todo'],
            includeExcluded: true
        }
        expect(serializeSearchQuery(state)).toEqual({
            q: '买菜',
            project: 'inbox,p1',
            tag: 't1,t2',
            priority: 'high',
            state: 'todo',
            excluded: '1'
        })
        expect(serializeSearchQuery({ ...state, includeExcluded: false })).not.toHaveProperty(
            'excluded'
        )
    })
})

describe('往返一致与等价判定', () => {
    it('serialize → parse 往返等价', () => {
        const state: SearchQueryState = {
            keyword: '发布上线',
            projectIds: ['', 'p1'],
            tagIds: ['t1'],
            priorities: ['medium', 'low'],
            states: ['done'],
            includeExcluded: true
        }
        expect(parseSearchQuery(serializeSearchQuery(state))).toEqual(state)
    })

    it('非法 query 清洗后等价于解析结果', () => {
        const parsed = parseSearchQuery({ priority: 'urgent', q: 'x' })
        expect(searchQueryEquals(parsed, parseSearchQuery(serializeSearchQuery(parsed)))).toBe(true)
    })

    it('searchQueryEquals 区分关键词/各维顺序与内容', () => {
        const base: SearchQueryState = {
            keyword: 'a',
            projectIds: ['p1', 'p2'],
            tagIds: [],
            priorities: [],
            states: [],
            includeExcluded: false
        }
        expect(searchQueryEquals(base, { ...base })).toBe(true)
        expect(searchQueryEquals(base, { ...base, keyword: 'b' })).toBe(false)
        expect(searchQueryEquals(base, { ...base, projectIds: ['p2', 'p1'] })).toBe(false)
        expect(searchQueryEquals(base, { ...base, tagIds: ['t1'] })).toBe(false)
        expect(searchQueryEquals(base, { ...base, includeExcluded: true })).toBe(false)
    })
})

describe('needsSearchQueryReExport - 本地真源对账（SEA-04-DEF-02 B 方案）', () => {
    const local: SearchQueryState = {
        keyword: '买菜',
        projectIds: [''],
        tagIds: [],
        priorities: ['high'],
        states: [],
        includeExcluded: true
    }

    it('本地有状态而路由 query 丢失（关详情/切详情场景）→ 需再导出', () => {
        expect(needsSearchQueryReExport(local, {})).toBe(true)
        expect(needsSearchQueryReExport(local, { project: 'inbox' })).toBe(true)
    })

    it('本地与路由等价（含解析归一）→ 不需再导出（短路防回环）', () => {
        const raw = {
            q: '买菜',
            project: 'inbox',
            priority: 'high',
            excluded: '1'
        }
        expect(needsSearchQueryReExport(local, raw)).toBe(false)
    })

    it('非法值被忽略后等价 → 不需再导出（不回写无意义导航）', () => {
        expect(needsSearchQueryReExport(EMPTY_SEARCH_QUERY, { priority: 'bogus', q: '' })).toBe(
            false
        )
    })
})