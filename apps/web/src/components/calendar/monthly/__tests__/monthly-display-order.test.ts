import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { sortCalendarTasks } from '../calendar-sort'
import { buildGridModel, buildWeekGrid, type CalendarSegment } from '../monthly-layout'

/**
 * TASK-15 日历展示顺序：撤销隐藏排序（PRD §5.2–§5.4）
 * @description 展示顺序唯一真源＝`sortCalendarTasks`（用户排序）；
 *              行内轨道仅保留 `colStart asc` 主键，同起始列内保持传入顺序（不再按 span 长度）；
 *              覆盖 AC1 轨道表、AC3 默认名称升序、AC4 同起始列不同跨度 / 跨周换轨道 / 重复渲染稳定。
 *              例中周起始取周一（PRD AC1）；日期用无时区字面量，weekday 由 dayjs 本地解析。
 */

type TaskInput = {
    id: string
    name: string
    priority?: TaskViewObject['priority']
    startAt?: string | null
    endAt?: string | null
}

const makeTask = ({ id, name, priority = 'low', startAt, endAt }: TaskInput): TaskViewObject =>
    ({
        id,
        name,
        state: 'todo',
        priority,
        startAt: startAt ?? null,
        endAt: endAt ?? null,
        createdAt: '2026-09-01 00:00:00',
        tags: []
    }) as unknown as TaskViewObject

// 2026-09-21 为周一；本周 = 09-21(一) ~ 09-27(日)
const WEEK1 = { startAt: '2026-09-21 00:00:00', endAt: '2026-09-27 00:00:00' }
const WEEK2 = { startAt: '2026-09-28 00:00:00', endAt: '2026-10-04 00:00:00' }

const SEPT = { year: 2026, monthIndex: 8 }
const PRIORITY_DESC = { field: 'priority', order: 'desc' } as const

/** 取某行的 segment（按 lane 升序），便于断言轨道表 */
const laneTable = (segments: CalendarSegment[]): string[] =>
    [...segments].sort((a, b) => a.lane - b.lane).map((s) => `${s.lane}:${s.task.name}`)

const rowWithSegments = (model: ReturnType<typeof buildGridModel>, count: number) =>
    model.rows.find((row) => row.segments.length === count)

describe('TASK-15 AC1：行内轨道按用户排序（原 colEnd desc 二次键已撤销）', () => {
    // 用户复现例：3×高·整周 + 1×高·周一全天 + 1×中·周一至周四；排序=优先级降序
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

    it('月视图 lane0..4 = 高整周①②③ → 高周一 → 中周一至周四（高优必须在中优之上）', () => {
        // 排序真源：优先级降序 ⇒ 4 条高优在前、中优在末（同优内部顺序不在此断言，避免 locale 耦合）
        const sorted = sortCalendarTasks(tasks, PRIORITY_DESC)
        expect(sorted.filter((t) => t.priority === 'high')).toHaveLength(4)
        expect(sorted.at(-1)!.name).toBe('中·周一至周四')

        // 轨道断言使用显式的用户排序顺序（＝sortedTasks 传入序），直接覆盖「不再按 colEnd」
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, tasks, null, 10, 'monday')
        const row = rowWithSegments(model, 5)!
        expect(laneTable(row.segments)).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:高·周一全天',
            '4:中·周一至周四'
        ])
        // 反向：若残留 colEnd desc，中·周一至周四（span 更长）会排在 高·周一全天 之前
        const laneOf = (name: string) => row.segments.find((s) => s.task.name === name)!.lane
        expect(laneOf('高·周一全天')).toBeLessThan(laneOf('中·周一至周四'))
    })

    it('周视图（buildRowContent 共用）得到同一轨道表', () => {
        const week = buildWeekGrid('2026-09-21', tasks, 10, 'monday')
        expect(laneTable(week.segments)).toEqual([
            '0:高·整周①',
            '1:高·整周②',
            '2:高·整周③',
            '3:高·周一全天',
            '4:中·周一至周四'
        ])
    })
})

describe('TASK-15 AC3：未选字段 ⇒ 默认名称升序（同名按 id 兜底）', () => {
    it('默认按名称升序', () => {
        const tasks = [
            makeTask({ id: '1', name: 'banana' }),
            makeTask({ id: '2', name: 'apple' }),
            makeTask({ id: '3', name: 'cherry' })
        ]
        expect(sortCalendarTasks(tasks, { order: 'asc' }).map((t) => t.name)).toEqual([
            'apple',
            'banana',
            'cherry'
        ])
    })

    it('同名 ⇒ 按 id 升序稳定兜底', () => {
        const tasks = [makeTask({ id: 'z', name: 'same' }), makeTask({ id: 'a', name: 'same' })]
        expect(sortCalendarTasks(tasks, { order: 'asc' }).map((t) => t.id)).toEqual(['a', 'z'])
    })

    it('选中字段时二次键恒为名称升序', () => {
        const tasks = [
            makeTask({ id: 'b', name: 'b', priority: 'high' }),
            makeTask({ id: 'a', name: 'a', priority: 'high' })
        ]
        expect(sortCalendarTasks(tasks, PRIORITY_DESC).map((t) => t.name)).toEqual(['a', 'b'])
    })
})

describe('TASK-15 AC4：同起始列内保持传入顺序（不再按跨度长度）', () => {
    it('同 colStart：短任务在前则占低轨道（长任务不再抢占）', () => {
        // 传入顺序 = 用户排序：短(周一) 在 长(整周) 之前
        const input = [
            makeTask({
                id: 'short',
                name: '短',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-21 00:00:00'
            }),
            makeTask({ id: 'long', name: '长', ...WEEK1 })
        ]
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, input, null, 10, 'monday')
        const row = rowWithSegments(model, 2)!
        expect(laneTable(row.segments)).toEqual(['0:短', '1:长'])
    })

    it('全部同起始列但不同跨度：严格按传入顺序分配轨道', () => {
        const input = [
            makeTask({ id: 'a', name: 'a', ...WEEK1 }),
            makeTask({
                id: 'b',
                name: 'b',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-21 00:00:00'
            }),
            makeTask({
                id: 'c',
                name: 'c',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-23 00:00:00'
            })
        ]
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, input, null, 10, 'monday')
        const row = rowWithSegments(model, 3)!
        expect(laneTable(row.segments)).toEqual(['0:a', '1:b', '2:c'])
    })

    it('跨周任务允许在不同周换轨道（不视为缺陷）', () => {
        const sorted = sortCalendarTasks(
            [
                // E 仅存在于第 2 周且高优，排在 A 之前
                makeTask({ id: 'E', name: 'E', priority: 'high', ...WEEK2 }),
                // A 横跨两周
                makeTask({
                    id: 'A',
                    name: 'A',
                    priority: 'low',
                    startAt: '2026-09-21 00:00:00',
                    endAt: '2026-10-04 00:00:00'
                })
            ],
            PRIORITY_DESC
        )
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, sorted, null, 10, 'monday')
        const laneOfA = (rowIndex: number) =>
            model.rows[rowIndex]!.segments.find((s) => s.task.id === 'A')!.lane
        // 第 1 周（09-21~09-27）A 独占 → lane0；第 2 周（09-28~10-04）E 在前 → A 落到 lane1
        expect(laneOfA(3)).toBe(0)
        expect(laneOfA(4)).toBe(1)
    })

    it('重复渲染顺序稳定（同一输入两次构建得到相同 lane/几何）', () => {
        const sorted = sortCalendarTasks(
            [
                makeTask({ id: 'f1', name: '高·整周①', priority: 'high', ...WEEK1 }),
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
            ],
            PRIORITY_DESC
        )
        const fingerprint = (segments: CalendarSegment[]) =>
            segments.map((s) => `${s.task.id}:${s.colStart}-${s.colEnd}@${s.lane}`)
        const first = buildGridModel(SEPT.year, SEPT.monthIndex, sorted, null, 10, 'monday')
        const second = buildGridModel(SEPT.year, SEPT.monthIndex, sorted, null, 10, 'monday')
        const rowFirst = rowWithSegments(first, 3)!
        const rowSecond = rowWithSegments(second, 3)!
        expect(fingerprint(rowSecond.segments)).toEqual(fingerprint(rowFirst.segments))
    })
})

describe('TASK-15 保留项：轨道总数不因撤销 colEnd 键而增加', () => {
    it('最大化重叠场景：轨道数 = 最大同日并发数（区间图最优着色）', () => {
        // 5 条均在周一（col 0）重叠，其中 3 条整周
        const input = [
            makeTask({ id: 'f1', name: 'f1', ...WEEK1 }),
            makeTask({ id: 'f2', name: 'f2', ...WEEK1 }),
            makeTask({ id: 'f3', name: 'f3', ...WEEK1 }),
            makeTask({
                id: 'm1',
                name: 'm1',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-21 00:00:00'
            }),
            makeTask({
                id: 'md',
                name: 'md',
                startAt: '2026-09-21 00:00:00',
                endAt: '2026-09-24 00:00:00'
            })
        ]
        const model = buildGridModel(SEPT.year, SEPT.monthIndex, input, null, 99, 'monday')
        const row = rowWithSegments(model, 5)!
        expect(new Set(row.segments.map((s) => s.lane)).size).toBe(5)
    })
})