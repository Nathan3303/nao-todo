import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { buildDayGrid } from '../build-day-grid'

/**
 * TASK-16 日视图模型（PRD §5.1–§5.4 / §5.7 冻结契约 / AC1–AC3）
 * @description 契约：`buildDayGrid(anchorKey, tasks, maxLanes, todayKey)` →
 *              `{ anchorKey, columns[{index,label}], timed[{task,colStart,colEnd,lane,isStart,isEnd}],
 *                 allDay[task], overflow[{key,count}], isToday }`。
 *              `isToday` 由注入 `todayKey` 判定（不依赖真实时钟）；`overflow` 日级单探针、key=anchorKey。
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

const ANCHOR = '2026-09-21'
const TODAY = '2026-09-21'
const day = (tasks: TaskViewObject[], maxLanes = 3) => buildDayGrid(ANCHOR, tasks, maxLanes, TODAY)
const find = (model: ReturnType<typeof buildDayGrid>, id: string) =>
    model.timed.find((s) => s.task.id === id)!

describe('TASK-16 日视图列模型（§5.1 / AC1）', () => {
    it('48 列；偶数位（整点）有文本 HH，奇数位（半点）无文本', () => {
        const model = day([])
        expect(model.columns).toHaveLength(48)
        expect(model.columns[0]!.label).toBe('00')
        expect(model.columns[1]!.label).toBe('')
        expect(model.columns[2]!.label).toBe('01')
        expect(model.columns[47]!.label).toBe('')
        // 逐列校验：偶数列 label 非空、奇数列 label 空
        for (const col of model.columns) {
            if (col.index % 2 === 0) expect(col.label).toMatch(/^\d{2}$/)
            else expect(col.label).toBe('')
        }
    })
})

describe('TASK-16 分钟级连续定位（§5.2 / AC1 / AC2）', () => {
    it('09:00–10:30 ⇒ colStart=18 / colEnd=20（1.5h 跨 3 列）', () => {
        const model = day([
            makeTask({ id: 'a', startAt: '2026-09-21 09:00:00', endAt: '2026-09-21 10:30:00' })
        ])
        const seg = find(model, 'a')
        expect(seg.colStart).toBe(18)
        expect(seg.colEnd).toBe(20)
        expect(seg.lane).toBe(0)
        expect(seg.isStart).toBe(true)
        expect(seg.isEnd).toBe(true)
    })

    it('14:37–15:07 ⇒ 连续小数列、宽 30 分钟、不被吸附', () => {
        const model = day([
            makeTask({ id: 'b', startAt: '2026-09-21 14:37:00', endAt: '2026-09-21 15:07:00' })
        ])
        const seg = find(model, 'b')
        expect(seg.colStart).toBeCloseTo(877 / 30, 10)
        expect(seg.colEnd).toBeCloseTo(907 / 30 - 1, 10)
        // 显示路径未吸附（不落到 29 或 30 整列）
        expect(seg.colStart).not.toBe(29)
        expect(seg.colStart).not.toBe(30)
    })

    it('时长 0 ⇒ 最小 30 分钟宽（colStart=colEnd=18）', () => {
        const model = day([
            makeTask({ id: 'z', startAt: '2026-09-21 09:00:00', endAt: '2026-09-21 09:00:00' })
        ])
        const seg = find(model, 'z')
        expect(seg.colStart).toBe(18)
        expect(seg.colEnd).toBe(18)
    })
})

describe('TASK-16 跨日裁剪与续接（§5.2 / §5.3 / AC3）', () => {
    it('昨 22:00–今 02:00 ⇒ 裁到 00:00–02:00 且左端续接（isStart=false）', () => {
        const model = day([
            makeTask({ id: 'c', startAt: '2026-09-20 22:00:00', endAt: '2026-09-21 02:00:00' })
        ])
        const seg = find(model, 'c')
        expect(seg.colStart).toBe(0)
        expect(seg.colEnd).toBe(120 / 30 - 1)
        expect(seg.isStart).toBe(false)
        expect(seg.isEnd).toBe(true)
    })

    it('今 22:00–明 02:00 ⇒ 裁到 22:00–24:00 且右端续接（isEnd=false）', () => {
        const model = day([
            makeTask({ id: 'd', startAt: '2026-09-21 22:00:00', endAt: '2026-09-22 02:00:00' })
        ])
        const seg = find(model, 'd')
        expect(seg.colStart).toBe(1320 / 30)
        expect(seg.colEnd).toBe(47)
        expect(seg.isStart).toBe(true)
        expect(seg.isEnd).toBe(false)
    })

    it('跨满全天（昨 00:00–明 00:00）⇒ 进全天行，不进时间轴', () => {
        const model = day([
            makeTask({ id: 'e', startAt: '2026-09-20 00:00:00', endAt: '2026-09-22 00:00:00' })
        ])
        expect(model.allDay.map((t) => t.id)).toContain('e')
        expect(model.timed.find((s) => s.task.id === 'e')).toBeUndefined()
    })
})

describe('TASK-16 全天行归属（§5.3 / A4′ / D1）', () => {
    it('仅 endAt 有效（startAt 空）⇒ 全天行（归属截止日）', () => {
        const model = day([makeTask({ id: 'f', startAt: null, endAt: '2026-09-21 10:00:00' })])
        expect(model.allDay.map((t) => t.id)).toEqual(['f'])
        expect(model.timed).toHaveLength(0)
    })

    it('仅 startAt 有效（endAt 空）⇒ 不进日视图（时间轴与全天行都无）', () => {
        const model = day([makeTask({ id: 'g', startAt: '2026-09-21 10:00:00', endAt: null })])
        expect(model.allDay.map((t) => t.id)).not.toContain('g')
        expect(model.timed.find((s) => s.task.id === 'g')).toBeUndefined()
    })

    it('两者皆无 ⇒ 不进日视图', () => {
        const model = day([makeTask({ id: 'h', startAt: null, endAt: null })])
        expect(model.allDay).toHaveLength(0)
        expect(model.timed).toHaveLength(0)
    })

    it('endAt 不在锚点日 ⇒ 不归属当天全天行', () => {
        const model = day([makeTask({ id: 'i', startAt: null, endAt: '2026-09-22 10:00:00' })])
        expect(model.allDay).toHaveLength(0)
    })
})

describe('TASK-16 轨道与 +N（§5.4 / A6 / D3）', () => {
    it('同起点按入参（用户排序）分配轨道；起点早者优先', () => {
        const model = day([
            makeTask({ id: 'm1', startAt: '2026-09-21 09:00:00', endAt: '2026-09-21 10:00:00' }),
            makeTask({ id: 'm2', startAt: '2026-09-21 09:00:00', endAt: '2026-09-21 11:00:00' }),
            // m3 结束改为 09:30（colEnd=18）以与 m1（colStart=18）重叠，验证「起点早者优先」
            makeTask({ id: 'm3', startAt: '2026-09-21 08:00:00', endAt: '2026-09-21 09:30:00' })
        ])
        // m3 起点最早 → lane0；m1/m2 同起点按入参序 → lane1/lane2
        expect(find(model, 'm3').lane).toBe(0)
        expect(find(model, 'm1').lane).toBe(1)
        expect(find(model, 'm2').lane).toBe(2)
    })

    it('不重叠区间复用低轨道（贪婪首次适配）', () => {
        const model = day([
            makeTask({ id: 'n1', startAt: '2026-09-21 08:00:00', endAt: '2026-09-21 08:30:00' }),
            makeTask({ id: 'n2', startAt: '2026-09-21 09:00:00', endAt: '2026-09-21 09:30:00' })
        ])
        // n1 占 col16；n2 起点 col18 > n1 结束 col16 ⇒ 复用 lane0
        expect(find(model, 'n1').lane).toBe(0)
        expect(find(model, 'n2').lane).toBe(0)
    })

    it('同时段 6 个任务、可视 3 轨 ⇒ 日级单一 +N（key=anchorKey，count=3）', () => {
        const tasks = Array.from({ length: 6 }, (_, i) =>
            makeTask({
                id: `t${i}`,
                startAt: '2026-09-21 09:00:00',
                endAt: '2026-09-21 10:00:00'
            })
        )
        const model = day(tasks, 3)
        expect(model.overflow).toHaveLength(1)
        expect(model.overflow[0]).toEqual({ key: ANCHOR, count: 3 })
    })
})

describe('TASK-16 当前时间线（§5.5 / AC5）', () => {
    it('isToday = (anchorKey === todayKey)，不依赖真实时钟', () => {
        expect(buildDayGrid(ANCHOR, [], 3, ANCHOR).isToday).toBe(true)
        expect(buildDayGrid(ANCHOR, [], 3, '2000-01-01').isToday).toBe(false)
        expect(buildDayGrid('2000-01-01', [], 3, ANCHOR).isToday).toBe(false)
    })
})

describe('TASK-19 档位矩阵：列数与标签（D1 / D1.1 / C2 / AC2）', () => {
    const MATRIX = [
        { zoom: 1, columnMinutes: 30, columns: 48, labels: 24 },
        { zoom: 1.5, columnMinutes: 30, columns: 48, labels: 24 },
        { zoom: 2, columnMinutes: 15, columns: 96, labels: 48 },
        { zoom: 3, columnMinutes: 15, columns: 96, labels: 48 },
        { zoom: 4, columnMinutes: 10, columns: 144, labels: 48 }
    ] as const

    for (const row of MATRIX) {
        it(`×${row.zoom} ⇒ ${row.columnMinutes}min / ${row.columns} 列 / ${row.labels} 个标签`, () => {
            const model = buildDayGrid(ANCHOR, [], 3, TODAY, {
                columnMinutes: row.columnMinutes
            })
            // I1：30 分钟必须为整数列
            expect(30 % row.columnMinutes).toBe(0)
            expect(model.columns).toHaveLength(row.columns)
            expect(model.columns).toHaveLength(1440 / row.columnMinutes)
            const labelled = model.columns.filter((col) => col.label !== '')
            expect(labelled).toHaveLength(row.labels)
        })
    }

    it('30min 档标签为 HH 且仅整点（24 个），与现状逐字节一致', () => {
        const model = buildDayGrid(ANCHOR, [], 3, TODAY, { columnMinutes: 30 })
        expect(model.columns[0]!.label).toBe('00')
        expect(model.columns[1]!.label).toBe('')
        expect(model.columns[2]!.label).toBe('01')
        expect(model.columns[47]!.label).toBe('')
        for (const col of model.columns) {
            if (col.index % 2 === 0) expect(col.label).toMatch(/^\d{2}$/)
            else expect(col.label).toBe('')
        }
    })

    it('15/10min 档标签为 HH:MM（整点+半点 48 个）；非 30 分钟刻度为空', () => {
        const model15 = buildDayGrid(ANCHOR, [], 3, TODAY, { columnMinutes: 15 })
        expect(model15.columns[0]!.label).toBe('00:00')
        expect(model15.columns[1]!.label).toBe('')
        expect(model15.columns[2]!.label).toBe('00:30')
        expect(model15.columns[3]!.label).toBe('')
        expect(model15.columns[4]!.label).toBe('01:00')
        for (const col of model15.columns) {
            const minutes = col.index * 15
            if (minutes % 30 === 0) expect(col.label).toMatch(/^\d{2}:\d{2}$/)
            else expect(col.label).toBe('')
        }

        const model10 = buildDayGrid(ANCHOR, [], 3, TODAY, { columnMinutes: 10 })
        expect(model10.columns[0]!.label).toBe('00:00')
        expect(model10.columns[1]!.label).toBe('')
        expect(model10.columns[2]!.label).toBe('')
        expect(model10.columns[3]!.label).toBe('00:30')
        expect(model10.columns[6]!.label).toBe('01:00')
        for (const col of model10.columns) {
            const minutes = col.index * 10
            if (minutes % 30 === 0) expect(col.label).toMatch(/^\d{2}:\d{2}$/)
            else expect(col.label).toBe('')
        }
    })

    it('10min 档最小条宽仍为 30 分钟（3 列）——MIN_SPAN_MIN 不随档位变（C2）', () => {
        const model = buildDayGrid(
            ANCHOR,
            [
                makeTask({
                    id: 'ms',
                    startAt: '2026-09-21 09:00:00',
                    endAt: '2026-09-21 09:00:00'
                })
            ],
            3,
            TODAY,
            { columnMinutes: 10 }
        )
        const seg = find(model, 'ms')
        expect(seg.colStart).toBe(540 / 10)
        expect(seg.colEnd).toBe(570 / 10 - 1)
    })
})

describe('TASK-19 纵向 V1：maxLanes=Infinity 全部轨道渲染（D4 / AC4）', () => {
    it('8 个同时段任务、maxLanes=Infinity ⇒ overflow 恒空且全部 item 有 lane', () => {
        const tasks = Array.from({ length: 8 }, (_, i) =>
            makeTask({
                id: `v${i}`,
                startAt: '2026-09-21 09:00:00',
                endAt: '2026-09-21 10:00:00'
            })
        )
        const model = buildDayGrid(ANCHOR, tasks, Number.POSITIVE_INFINITY, TODAY)
        expect(model.overflow).toHaveLength(0)
        expect(model.timed).toHaveLength(8)
        expect(model.timed.every((seg) => Number.isInteger(seg.lane) && seg.lane >= 0)).toBe(true)
        expect(new Set(model.timed.map((seg) => seg.lane)).size).toBe(8)
    })
})