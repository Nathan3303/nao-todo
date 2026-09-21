import { describe, expect, it } from 'vite-plus/test'
import { GRID_COLUMNS } from '../monthly-layout'
import {
    GRID_ITEM_STEP,
    GRID_TOP_OFFSET,
    segmentStyleInColumns,
    segmentStyleOf
} from '../use-calendar-grid'

/**
 * TASK-16 几何参数化（ADR §2 / C1–C2）
 * @description `segmentStyleInColumns` 为三视图唯一几何实现；`colStart/colEnd` 闭区间、允许小数；
 *              `segmentStyleOf` 委托它（默认 7 列）。日视图 48 列（30 分钟/列）。
 *              既有 `use-calendar-grid.test.ts`（segmentStyleOf）保持零改动。
 */
describe('segmentStyleInColumns - 列数可配几何（48 列日视图）', () => {
    const DAY_COLUMNS = 48
    const pct = (value: string) => Number.parseFloat(value)

    it('09:00–10:30 ⇒ colStart=18 / colEnd=20（闭区间）、width=3/48', () => {
        // 09:00=540min → 540/30=18；10:30=630min → 630/30−1=20
        const style = segmentStyleInColumns({ colStart: 18, colEnd: 20, lane: 0 }, DAY_COLUMNS, 0)
        expect(pct(style.left)).toBeCloseTo((18 / DAY_COLUMNS) * 100, 10)
        expect(pct(style.width)).toBeCloseTo((3 / DAY_COLUMNS) * 100, 10)
        expect(pct(style.width)).toBeCloseTo((3 / 48) * 100, 10)
    })

    it('14:37–15:07 ⇒ 连续小数列（≈29.2333）且 width=1/48，不被吸附', () => {
        // 14:37=877min → 877/30=29.2333…；15:07=907min → 907/30−1=29.2333…
        const colStart = 877 / 30
        const colEnd = 907 / 30 - 1
        expect(colStart).toBeCloseTo(29.233333333333334, 10)
        const style = segmentStyleInColumns({ colStart, colEnd, lane: 0 }, DAY_COLUMNS, 0)
        expect(pct(style.left)).toBeCloseTo((877 / 1440) * 100, 10)
        expect(pct(style.left)).toBeCloseTo(60.90277777777778, 6)
        expect(pct(style.width)).toBeCloseTo((1 / DAY_COLUMNS) * 100, 10)
        // 显示路径未吸附：left 不等于 14:30（29/48）或 15:00（30/48）整列位置
        expect(pct(style.left)).not.toBeCloseTo((29 / 48) * 100, 6)
        expect(pct(style.left)).not.toBeCloseTo((30 / 48) * 100, 6)
    })

    it('endMin=1440 ⇒ colEnd=47、右缘 100%', () => {
        const colEnd = 1440 / 30 - 1
        expect(colEnd).toBe(47)
        const style = segmentStyleInColumns({ colStart: 0, colEnd, lane: 0 }, DAY_COLUMNS, 0)
        expect(pct(style.left) + pct(style.width)).toBeCloseTo(100, 10)
        expect(pct(style.width)).toBeCloseTo(100, 10)
    })

    it('startMin=0 ⇒ left=0%', () => {
        const style = segmentStyleInColumns({ colStart: 0, colEnd: 1, lane: 0 }, DAY_COLUMNS, 0)
        expect(style.left).toBe('0%')
    })

    it('top 按 lane 步进，且 topOffset 可注入', () => {
        expect(
            segmentStyleInColumns({ colStart: 0, colEnd: 0, lane: 2 }, DAY_COLUMNS, 10).top
        ).toBe(`${10 + 2 * GRID_ITEM_STEP}px`)
        expect(segmentStyleInColumns({ colStart: 0, colEnd: 0, lane: 0 }, DAY_COLUMNS).top).toBe(
            `${GRID_TOP_OFFSET}px`
        )
    })

    it('segmentStyleOf 委托 segmentStyleInColumns（默认 7 列，零破坏）', () => {
        const seg = { colStart: 2, colEnd: 4, lane: 1 }
        expect(segmentStyleOf(seg, 0)).toEqual(segmentStyleInColumns(seg, GRID_COLUMNS, 0))
    })
})