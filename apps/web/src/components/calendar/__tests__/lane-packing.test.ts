import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { buildGridModel, buildWeekGrid } from '../monthly/monthly-layout'
import { packLanes, type LaneProbe } from '../lane-packing'

/**
 * TASK-16 轨道打包抽取（ADR §3 / C3–C4）
 * @description `packLanes` 为月/周/日唯一打包实现：稳定排序仅按 `colStart`（禁 `colEnd`，
 *              TASK-15 D1）；贪婪首次适配；探针式溢出。月/周 7 探针输出须与现状逐字节等价；
 *              日视图单探针 `[0,47]` 得到日级单一 `+N`。
 */

const makeTask = (input: {
    id: string
    name?: string
    startAt: string | null
    endAt: string | null
}): TaskViewObject =>
    ({
        id: input.id,
        name: input.name ?? input.id,
        state: 'todo',
        priority: 'low',
        startAt: input.startAt,
        endAt: input.endAt,
        createdAt: '2026-09-01 00:00:00',
        tags: []
    }) as unknown as TaskViewObject

const laneById = <T extends { id: string }>(packed: (T & { lane: number })[]) =>
    new Map(packed.map((p) => [p.id, p.lane]))

describe('packLanes - 贪婪首次适配', () => {
    it('重叠区间分配到首个无重叠轨道', () => {
        const items = [
            { id: 'a', colStart: 0, colEnd: 6 },
            { id: 'b', colStart: 0, colEnd: 0 },
            { id: 'c', colStart: 2, colEnd: 4 }
        ]
        const { packed } = packLanes(items, 10, [])
        const lanes = laneById(packed)
        expect(lanes.get('a')).toBe(0)
        expect(lanes.get('b')).toBe(1)
        // c 起点 2：lane0 被 a(→6) 占；lane1 的 b 结束 0 < 2 ⇒ 复用 lane1
        expect(lanes.get('c')).toBe(1)
    })

    it('稳定排序仅按 colStart：同起点保持入参顺序（禁 colEnd 比较）', () => {
        // ① 入参序被尊重：长跨度在前 → 仍占 lane0
        const longFirst = [
            { id: 'long', colStart: 0, colEnd: 6 },
            { id: 'short', colStart: 0, colEnd: 0 }
        ]
        expect(packLanes(longFirst, 10, []).packed.map((p) => `${p.id}:${p.lane}`)).toEqual([
            'long:0',
            'short:1'
        ])

        // ② 同 colStart 内保持入参序（短跨度在前 → 仍在 lane0）；若混入 colEnd 比较会被重排而失败
        const input = [
            { id: 'short', colStart: 0, colEnd: 0 },
            { id: 'long', colStart: 0, colEnd: 6 }
        ]
        expect(packLanes(input, 10, []).packed.map((p) => `${p.id}:${p.lane}`)).toEqual([
            'short:0',
            'long:1'
        ])

        // ③ 真实旧键（colStart asc || colEnd desc）确实会把 short 重排到 long 之后 ⇒ 判别力成立
        const oldOrdered = [...input].sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd)
        expect(oldOrdered.map((i) => i.id)).toEqual(['long', 'short'])
        expect(packLanes(oldOrdered, 10, []).packed.map((p) => `${p.id}:${p.lane}`)).toEqual([
            'long:0',
            'short:1'
        ])
    })
})

describe('packLanes - 探针式溢出', () => {
    it('月/周 7 探针：仅统计 lane>=maxLanes 且与探针相交的项', () => {
        const items = [
            { id: 'a', colStart: 0, colEnd: 6 },
            { id: 'b', colStart: 0, colEnd: 0 },
            { id: 'c', colStart: 0, colEnd: 1 }
        ]
        const probes: LaneProbe[] = Array.from({ length: 7 }, (_, i) => ({
            key: `d${i}`,
            colStart: i,
            colEnd: i
        }))
        const { overflow } = packLanes(items, 1, probes)
        const byKey = new Map(overflow.map((o) => [o.key, o.count]))
        // lane0=a(0..6) 可见；b(lane1)、c(lane2) 隐藏
        expect(byKey.get('d0')).toBe(2) // b、c 覆盖列 0
        expect(byKey.get('d1')).toBe(1) // 仅 c 覆盖列 1
        expect(byKey.get('d2') ?? 0).toBe(0) // 无隐藏项覆盖列 2（零计数省略）
    })

    it('日视图单探针 [0,47] ⇒ 日级单一 +N 计数', () => {
        const items = Array.from({ length: 6 }, (_, i) => ({
            id: `t${i}`,
            colStart: 18,
            colEnd: 20
        }))
        const { overflow } = packLanes(items, 3, [{ key: 'day', colStart: 0, colEnd: 47 }])
        expect(overflow).toHaveLength(1)
        expect(overflow[0]).toEqual({ key: 'day', count: 3 })
    })
})

describe('packLanes - 月/周输出与现状逐字节等价（C4）', () => {
    const tasks: TaskViewObject[] = [
        makeTask({ id: 'w1', startAt: '2026-09-21 00:00:00', endAt: '2026-09-27 00:00:00' }),
        makeTask({ id: 'w2', startAt: '2026-09-21 00:00:00', endAt: '2026-09-21 00:00:00' }),
        makeTask({ id: 'w3', startAt: '2026-09-21 00:00:00', endAt: '2026-09-22 00:00:00' }),
        makeTask({ id: 'w4', startAt: '2026-09-23 00:00:00', endAt: '2026-09-24 00:00:00' })
    ]

    it('周视图：同区间入参 → packLanes lane 与 buildWeekGrid 一致', () => {
        const week = buildWeekGrid('2026-09-21', tasks, 10, 'monday')
        const items = week.segments.map((s) => ({
            id: s.task.id,
            colStart: s.colStart,
            colEnd: s.colEnd
        }))
        const { packed } = packLanes(items, 10, [])
        const lanes = laneById(packed)
        for (const seg of week.segments) {
            expect(lanes.get(seg.task.id)).toBe(seg.lane)
        }
    })

    it('周视图：7 探针溢出计数与 buildWeekGrid.overflow 一致', () => {
        const week = buildWeekGrid('2026-09-21', tasks, 1, 'monday')
        const items = week.segments.map((s) => ({
            id: s.task.id,
            colStart: s.colStart,
            colEnd: s.colEnd
        }))
        const probes: LaneProbe[] = week.days.map((day, i) => ({
            key: day.dateKey,
            colStart: i,
            colEnd: i
        }))
        const { overflow } = packLanes(items, 1, probes)
        const expected = new Map(week.overflow.map((o) => [o.dateKey, o.count]))
        for (const probe of probes) {
            expect(overflow.find((o) => o.key === probe.key)?.count ?? 0).toBe(
                expected.get(probe.key) ?? 0
            )
        }
    })

    it('月视图：行内 lane 与 buildGridModel 一致', () => {
        const model = buildGridModel(2026, 8, tasks, null, 10, 'monday')
        const row = model.rows.find((r) => r.segments.length === 4)!
        const items = row.segments.map((s) => ({
            id: s.task.id,
            colStart: s.colStart,
            colEnd: s.colEnd
        }))
        const { packed } = packLanes(items, 10, [])
        const lanes = laneById(packed)
        for (const seg of row.segments) {
            expect(lanes.get(seg.task.id)).toBe(seg.lane)
        }
    })
})