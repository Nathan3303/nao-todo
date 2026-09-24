import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { GRID_COLUMNS, MAX_VISIBLE_LANES } from './monthly-layout'

/**
 * useCalendarGrid —— 月/周视图共享几何与可视轨道测量（O2 抽取）
 * @description 网格几何常量（与 calendar-grid.css 数值一致）与 DEF-2 动态可视轨道数：
 *              ResizeObserver + 100ms 防抖随行高实时调整；挂载即测，卸载清理。
 *              数据/视图状态变化后的补量由调用方自行 watch + measure（触发源因视图而异）。
 */

/** 日期号区域高度 + 首个任务条上间距（月/周同值） */
export const GRID_TOP_OFFSET = 26
/** 单条任务条高度(20，TASK-07 由 16 增加) + 纵向间距(2) */
export const GRID_ITEM_STEP = 22
/** 格底预留条带（DEF-1：+/+N/编辑器占用，任务条区其上截断） */
export const GRID_BAND_HEIGHT = 24

/**
 * 任务条定位样式（列数可配；三视图唯一几何实现，ADR C1–C2）
 * @description `colStart/colEnd` 为闭区间列坐标（`colEnd` 含）、允许小数；
 *              日视图 `columnCount=48`、`colStart=startMin/30`、`colEnd=endMin/30−1`。
 */
export const segmentStyleInColumns = (
    seg: { colStart: number; colEnd: number; lane: number },
    columnCount: number,
    topOffset: number = GRID_TOP_OFFSET
): { left: string; width: string; top: string } => {
    const left = (seg.colStart / columnCount) * 100
    const width = ((seg.colEnd - seg.colStart + 1) / columnCount) * 100
    return {
        left: `${left}%`,
        width: `${width}%`,
        top: `${topOffset + seg.lane * GRID_ITEM_STEP}px`
    }
}

/** 月/周既有入口（默认 7 列）：委托 `segmentStyleInColumns`，零破坏 */
export const segmentStyleOf = (
    seg: { colStart: number; colEnd: number; lane: number },
    topOffset: number = GRID_TOP_OFFSET
): { left: string; width: string; top: string } =>
    segmentStyleInColumns(seg, GRID_COLUMNS, topOffset)

/**
 * @param opts.containerEl 网格容器 ref（月 .cal-body / 周 .wk-body）
 * @param opts.rowSelector 行选择器（月 .cal-row / 周 .wk-row），用于行高实测
 */
export const useCalendarGrid = (opts: {
    containerEl: Ref<HTMLElement | null>
    rowSelector: string
}) => {
    const { containerEl, rowSelector } = opts

    // @states 动态可视轨道数（DEF-2：由行高实测决定；未测得前回退 3）
    const laneLimit = ref<number>(MAX_VISIBLE_LANES)
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let bodyObserver: ResizeObserver | undefined

    // @method 按行实际高度计算可视条数：max(1, floor((行高 − 顶部26 − 底部留白24) / 18))
    const measure = (): void => {
        const row = containerEl.value?.querySelector<HTMLElement>(rowSelector)
        const rowHeight = row?.clientHeight ?? 0
        if (rowHeight <= 0) return
        const next = Math.max(
            1,
            Math.floor((rowHeight - GRID_TOP_OFFSET - GRID_BAND_HEIGHT) / GRID_ITEM_STEP)
        )
        if (next !== laneLimit.value) laneLimit.value = next
    }
    const scheduleLaneMeasure = (): void => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(measure, 100)
    }

    // @method 将 RO 挂到当前容器（v-if 重建后重新 observe 用；幂等）
    const attach = (): void => {
        bodyObserver?.disconnect()
        const el = containerEl.value
        // 无 ResizeObserver 的运行环境（如 jsdom 单测）降级：不观测，laneLimit 保持回退值
        if (!el || typeof ResizeObserver === 'undefined') return
        bodyObserver = new ResizeObserver(scheduleLaneMeasure)
        bodyObserver.observe(el)
    }

    // @lifecycle 观测网格容器高度（窗口缩放等变化实时调整；卸载清理）
    onMounted(() => {
        attach()
        measure()
    })
    onUnmounted(() => {
        bodyObserver?.disconnect()
        bodyObserver = undefined
        clearTimeout(resizeTimer)
    })

    return { laneLimit, measure, attach }
}