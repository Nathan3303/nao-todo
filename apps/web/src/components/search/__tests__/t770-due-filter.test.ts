import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { searchTasks } from '../search-tasks'
import { dateKeyOfIso, isDueRangeActive, EMPTY_DUE_RANGE } from '../search-sort'

/**
 * T770 · 截止日区间筛选
 * 口径（需求 3）：按**截止日**（任务 `endAt`，本地自然日）区间筛选，闭区间 `[起, 止]`，
 * 起/止可单边（`''` = 该侧不限），默认关闭；**无截止日的任务默认排除**，勾选「包含无截止日」后保留。
 */

const makeTask = (
    overrides: Partial<TaskViewObject> & Pick<TaskViewObject, 'id' | 'name'>
): TaskViewObject =>
    ({
        parentTaskId: '',
        userId: 'u1',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '',
        endAt: '',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides
    }) as unknown as TaskViewObject

/** 本地某日某刻的 ISO（与「本地自然日」口径同源，测试与运行机时区无关） */
const isoOf = (year: number, month: number, day: number, hour = 12, minute = 0): string =>
    new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()

const KW = '找'
const ids = (tasks: TaskViewObject[], options: Parameters<typeof searchTasks>[2]): string[] =>
    searchTasks(tasks, KW, options).map((row) => row.task.id)

/** 命中集合（顺序不是本文件关注点 ⇒ 排序后比较） */
const setOf = (tasks: TaskViewObject[], options: Parameters<typeof searchTasks>[2]): string[] =>
    ids(tasks, options).slice().sort()

const tasks = [
    makeTask({ id: 'before', name: '找上月', endAt: isoOf(2026, 2, 28, 23, 59) }),
    makeTask({ id: 'start', name: '找起日', endAt: isoOf(2026, 3, 1, 0, 0) }),
    makeTask({ id: 'middle', name: '找中间', endAt: isoOf(2026, 3, 15, 12, 0) }),
    makeTask({ id: 'end', name: '找止日', endAt: isoOf(2026, 3, 31, 23, 59) }),
    makeTask({ id: 'after', name: '找下月', endAt: isoOf(2026, 4, 1, 0, 0) }),
    makeTask({ id: 'nodue', name: '找无期' })
]

describe('T770 截止日区间：闭区间边界', () => {
    it('起/止双端：恰好起日 00:00 与止日 23:59 都包含（闭区间）', () => {
        expect(setOf(tasks, { dueRange: { from: '2026-03-01', to: '2026-03-31' } })).toEqual([
            'end',
            'middle',
            'start'
        ])
    })

    it('当天（起=止）：只命中该自然日（含当日任意时刻）', () => {
        expect(ids(tasks, { dueRange: { from: '2026-03-15', to: '2026-03-15' } })).toEqual([
            'middle'
        ])
    })

    it('跨天区间覆盖多日；边界外一天不含', () => {
        expect(ids(tasks, { dueRange: { from: '2026-03-02', to: '2026-03-30' } })).toEqual([
            'middle'
        ])
    })
})

describe('T770 截止日区间：单边', () => {
    it('仅起（不早于）', () => {
        expect(ids(tasks, { dueRange: { from: '2026-04-01', to: '' } })).toEqual(['after'])
    })

    it('仅止（不晚于）', () => {
        expect(ids(tasks, { dueRange: { from: '', to: '2026-02-28' } })).toEqual(['before'])
    })

    it('仅起时无截止日仍被排除（默认口径）', () => {
        expect(setOf(tasks, { dueRange: { from: '2026-03-01', to: '' } })).toEqual([
            'after',
            'end',
            'middle',
            'start'
        ])
    })
})

describe('T770 无截止日：默认排除 + 勾选保留', () => {
    it('区间生效 + 默认 ⇒ 无截止日不出现', () => {
        const got = ids(tasks, { dueRange: { from: '2026-03-01', to: '2026-03-31' } })
        expect(got).not.toContain('nodue')
    })

    it('区间生效 + includeNoDue ⇒ 无截止日保留（不受区间约束）', () => {
        const got = ids(tasks, {
            dueRange: { from: '2026-03-01', to: '2026-03-31' },
            includeNoDue: true
        })
        expect(got).toContain('nodue')
        expect(got).toHaveLength(4)
    })

    it('区间未生效（默认关闭）⇒ includeNoDue 无副作用，结果与无筛选一致', () => {
        const base = ids(tasks, {})
        expect(ids(tasks, { dueRange: EMPTY_DUE_RANGE })).toEqual(base)
        expect(ids(tasks, { dueRange: { from: '', to: '' }, includeNoDue: true })).toEqual(base)
    })
})

describe('T770 截止日与其它条件叠加 / 工具函数', () => {
    it('区间 + 关键词同时生效（AND）', () => {
        const mixed = [
            ...tasks,
            makeTask({ id: 'other', name: '无关任务', endAt: isoOf(2026, 3, 20) })
        ]
        expect(setOf(mixed, { dueRange: { from: '2026-03-01', to: '2026-03-31' } })).toEqual([
            'end',
            'middle',
            'start'
        ])
    })

    it('dateKeyOfIso：本地自然日、空/非法 → 空串', () => {
        expect(dateKeyOfIso(isoOf(2026, 3, 5, 0, 0))).toBe('2026-03-05')
        expect(dateKeyOfIso(isoOf(2026, 3, 5, 23, 59))).toBe('2026-03-05')
        expect(dateKeyOfIso('2026-03-05')).toBe('2026-03-05')
        expect(dateKeyOfIso('')).toBe('')
        expect(dateKeyOfIso(null)).toBe('')
        expect(dateKeyOfIso('not-a-date')).toBe('')
    })

    it('isDueRangeActive：单边也算生效，双空为关闭', () => {
        expect(isDueRangeActive({ from: '', to: '' })).toBe(false)
        expect(isDueRangeActive({ from: '2026-03-01', to: '' })).toBe(true)
        expect(isDueRangeActive({ from: '', to: '2026-03-01' })).toBe(true)
        expect(isDueRangeActive(EMPTY_DUE_RANGE)).toBe(false)
    })
})