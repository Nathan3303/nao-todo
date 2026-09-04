import { describe, expect, it } from 'vite-plus/test'
import { buildCalendarListQuery, MAX_PAGES, PAGE_LIMIT } from './list-query'

describe('buildCalendarListQuery - 服务端筛选查询构造', () => {
    const emptyFilter = { projectIds: [], tagIds: [], hideCompleted: false }

    it('无筛选时只带基础约束与稳定排序', () => {
        const opts = buildCalendarListQuery(emptyFilter, 1)
        expect(opts.isGivenUp).toBe(false)
        expect(opts.isDeleted).toBe(false)
        expect(opts.isArchived).toBe(false)
        expect(opts.sort).toEqual({ field: 'id', order: 'asc' })
        expect(opts.limit).toBe(PAGE_LIMIT)
        expect(opts.page).toBe(1)
        expect(opts.projectId).toBeUndefined()
        expect(opts.tagId).toBeUndefined()
        expect(opts.state).toBeUndefined()
    })

    it('多清单 -> projectId 逗号多值（组内 OR）', () => {
        const opts = buildCalendarListQuery({ ...emptyFilter, projectIds: ['p1', 'p2'] }, 1)
        expect(opts.projectId).toBe('p1,p2')
        expect(opts.tagId).toBeUndefined()
    })

    it('多标签 -> tagId 逗号多值（组内 OR）', () => {
        const opts = buildCalendarListQuery({ ...emptyFilter, tagIds: ['t1', 't2'] }, 1)
        expect(opts.tagId).toBe('t1,t2')
        expect(opts.projectId).toBeUndefined()
    })

    it('清单 x 标签同时给出 -> 组间 AND 同传', () => {
        const opts = buildCalendarListQuery(
            { projectIds: ['p1', 'p2'], tagIds: ['t1', 't2'], hideCompleted: false },
            1
        )
        expect(opts.projectId).toBe('p1,p2')
        expect(opts.tagId).toBe('t1,t2')
    })

    it('隐藏已完成 -> state=todo,in-progress', () => {
        const opts = buildCalendarListQuery({ ...emptyFilter, hideCompleted: true }, 1)
        expect(opts.state).toBe('todo,in-progress')
    })

    it('组合场景：多清单 + 多标签 + 隐藏已完成', () => {
        const opts = buildCalendarListQuery(
            { projectIds: ['p1'], tagIds: ['t1', 't2'], hideCompleted: true },
            1
        )
        expect(opts.projectId).toBe('p1')
        expect(opts.tagId).toBe('t1,t2')
        expect(opts.state).toBe('todo,in-progress')
    })

    it('page 透传（全量分页）', () => {
        const opts = buildCalendarListQuery(emptyFilter, 3)
        expect(opts.page).toBe(3)
        expect(MAX_PAGES).toBeGreaterThan(0)
    })
})