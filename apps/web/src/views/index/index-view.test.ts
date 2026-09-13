import { describe, expect, it } from 'vite-plus/test'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { taskDetailsLocation } from './task-details-location'

/**
 * SEA-04-DEF-01 回归：详情下钻必须保留当前 query
 * @description 从 `/search?q=…` 下钻 `/search/<taskId>` 时若丢 query，
 *              `use-search.ts` 会把搜索状态回写成空 → 关键词/筛选被清空。
 */

/** 仅取 name/query 的当前路由替身（helper 只依赖该两字段） */
const makeRoute = (
    name: string | null,
    query: Record<string, string | string[]>
): Pick<RouteLocationNormalizedLoaded, 'name' | 'query'> =>
    ({ name, query }) as unknown as Pick<RouteLocationNormalizedLoaded, 'name' | 'query'>

describe('taskDetailsLocation - 详情下钻保留 query', () => {
    it('搜索视图：携带 q 与筛选下钻，query 不丢', () => {
        const location = taskDetailsLocation(
            makeRoute('search', { q: '买菜', project: 'inbox', state: 'todo' }),
            'task-1'
        ) as { name: unknown; params: unknown; query: unknown }
        expect(location.name).toBe('search')
        expect(location.params).toEqual({ taskId: 'task-1' })
        expect(location.query).toEqual({ q: '买菜', project: 'inbox', state: 'todo' })
    })

    it('无 query 视图（tasks/calendar/pomodoro）：保留为空，行为与原先一致', () => {
        const location = taskDetailsLocation(makeRoute('tasks', {}), 'task-2') as {
            query: unknown
        }
        expect(location.query).toEqual({})
    })

    it('当前路由 name 为空时不影响 taskId 下钻', () => {
        const location = taskDetailsLocation(makeRoute(null, {}), 'task-3') as {
            params: unknown
        }
        expect(location.params).toEqual({ taskId: 'task-3' })
    })
})