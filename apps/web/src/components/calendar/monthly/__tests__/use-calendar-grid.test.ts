import { describe, expect, it } from 'vite-plus/test'
import { GRID_ITEM_STEP, GRID_TOP_OFFSET, segmentStyleOf } from '../use-calendar-grid'

/**
 * 网格几何纯函数（O2 抽取回归）
 * @description 任务条定位：7 列等分 left/width、top 按轨道步进（与共享样式常量一致）。
 */
describe('segmentStyleOf - 任务条定位', () => {
    it('7 列等分：colStart/colEnd → 百分比 left/width', () => {
        expect(segmentStyleOf({ colStart: 0, colEnd: 0, lane: 0 })).toEqual({
            left: '0%',
            width: '14.285714285714285%',
            top: `${GRID_TOP_OFFSET}px`
        })
        expect(segmentStyleOf({ colStart: 2, colEnd: 4, lane: 0 })).toEqual({
            left: '28.57142857142857%',
            width: '42.857142857142854%',
            top: `${GRID_TOP_OFFSET}px`
        })
    })

    it('top 按轨道步进（顶部偏移 + lane × 步长；可注入 topOffset）', () => {
        expect(segmentStyleOf({ colStart: 0, colEnd: 6, lane: 1 })).toEqual({
            left: '0%',
            width: '100%',
            top: `${GRID_TOP_OFFSET + GRID_ITEM_STEP}px`
        })
        expect(segmentStyleOf({ colStart: 0, colEnd: 0, lane: 0 }, 0)).toEqual({
            left: '0%',
            width: '14.285714285714285%',
            top: '0px'
        })
    })
})