import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { buildGridModel, buildWeekGrid, type CalendarSegment } from '../monthly-layout'

/**
 * T45 判别力验证：T44 轨道断言能否检出「恢复 colEnd desc」回归
 * @description 不修改产品码。利用「buildGridModel 内部对 span 仅做 colStart 稳定排序」的事实：
 *              把输入任务预先按旧比较键 `colStart asc || colEnd desc` 排好，稳定排序会保留组内
 *              旧序，从而在**当前实现**下复现旧行为，再与新行为对比。
 *              结论：两者轨道表不同 ⇒ T44 断言具备判别力。
 */

const makeTask = (input: {
    id: string
    name: string
    priority?: TaskViewObject['priority']
    startAt: string | null
    endAt: string | null
}): TaskViewObject =>
    ({
        id: input.id,
        name: input.name,
        state: 'todo',
        priority: input.priority ?? 'low',
        startAt: input.startAt,
        endAt: input.endAt,
        createdAt: '2026-09-01 00:00:00',
        tags: []
    }) as unknown as TaskViewObject

const WEEK1 = { startAt: '2026-09-21 00:00:00', endAt: '2026-09-27 00:00:00' }
const SEPT = { year: 2026, monthIndex: 8 }

const laneTable = (segments: CalendarSegment[]): string[] =>
    [...segments].sort((a, b) => a.lane - b.lane).map((s) => `${s.lane}:${s.task.name}`)

/** 用「旧比较键预排输入」在当前实现下复现旧行为（不改产品码） */
const buildWithOldOrder = (segments: CalendarSegment[]) => {
    const oldOrdered = [...segments]
        .sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd)
        .map((s) => s.task)
    const model = buildGridModel(SEPT.year, SEPT.monthIndex, oldOrdered, null, 10, 'monday')
    const row = model.rows.find((r) => r.segments.length === segments.length)!
    return laneTable(row.segments)
}

describe('T45 判别力：colEnd desc 回归必被 T44 断言检出', () => {
    // 与 T44 AC1 相同的用户复现例
    const tasks: TaskViewObject[] = [
        makeTask({ id: 'f1', name: '高·整周①', priority: 'high', ...WEEK1 }),
        makeTask({ id: 'f2', name: '高·整周②', priority: 'high', ...WEEK1 }),
        makeTask({ id: 'f3', name: '高·整周③', priority: 'high', ...WEEK1 }),
        makeTask({
            id: 'm1',
            name: '高·周一全天',
            priority: 'high',
            startAt: '2026-09-21 00:00:00',
            endAt: '2026-09-21 00:00:00'
        }),
        makeTask({
            id: 'md',
            name: '中·周一至周四',
            priority: 'medium',
            startAt: '2026-09-21 00:00:00',
            endAt: '2026-09-24 00:00:00'
        })
    ]

    it('新行为表 ≠ 旧行为表（旧序把长条 md 排到 m1 之前）', () => {
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, tasks, null, 10, 'monday')
        const row = model.rows.find((r) => r.segments.length === 5)!
        const newTable = laneTable(row.segments)
        const oldTable = buildWithOldOrder(row.segments)

        expect(newTable).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:高·周一全天',
            '4:中·周一至周四'
        ])
        // 旧比较键下：md(colEnd 3) 先于 m1(colEnd 0)
        expect(oldTable).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:中·周一至周四',
            '4:高·周一全天'
        ])
        expect(oldTable).not.toEqual(newTable)
    })

    it('同 colStart 不同跨度：新旧表不同，但轨道总数不变（组内两两在起点重叠）', () => {
        const input = [
            makeTask({ id: 'x', name: 'X', ...WEEK1 }), // col0-6
            makeTask({
                id: 'y',
                name: 'Y',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-21 00:00:00'
            }), // col0-0
            makeTask({
                id: 'z',
                name: 'Z',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-23 00:00:00'
            }) // col0-2
        ]
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, input, null, 10, 'monday')
        const row = model.rows.find((r) => r.segments.length === 3)!
        const newTable = laneTable(row.segments)
        const oldTable = buildWithOldOrder(row.segments)

        expect(newTable).toEqual(['0:X', '1:Y', '2:Z']) // 传入序
        expect(oldTable).toEqual(['0:X', '1:Z', '2:Y']) // colEnd desc
        expect(oldTable).not.toEqual(newTable)
        const laneCount = (table: string[]) => new Set(table.map((t) => t.split(':')[0])).size
        expect(laneCount(oldTable)).toBe(laneCount(newTable))
    })

    it('周视图 buildWeekGrid 独立复核：新序按用户排序、旧序按 colEnd desc', () => {
        const week = buildWeekGrid('2026-09-21', tasks, 10, 'monday')
        const newTable = laneTable(week.segments)
        expect(newTable).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:高·周一全天',
            '4:中·周一至周四'
        ])
        const oldOrdered = [...week.segments]
            .sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd)
            .map((s) => s.task)
        const oldWeek = buildWeekGrid('2026-09-21', oldOrdered, 10, 'monday')
        expect(laneTable(oldWeek.segments)).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:中·周一至周四',
            '4:高·周一全天'
        ])
    })
})