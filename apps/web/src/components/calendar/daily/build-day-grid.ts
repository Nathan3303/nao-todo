import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { packLanes } from '../lane-packing'
import { MAX_VISIBLE_LANES, todayDateKey } from '../monthly/monthly-layout'

/**
 * 日视图模型（PRD §5.1–§5.4 / §5.7 冻结契约；ADR C2–C3 / C11 / C13）
 * @description 48 列时间轴（30 分钟/列）；任务按**真实 `startAt/endAt`** 折算为分钟级分数列
 *              （`colStart=startMin/30`、`colEnd=endMin/30−1`，闭区间、连续不吸附）；
 *              跨日裁剪到当日并以 `isStart/isEnd` 标记续接；时长为 0 → 最小 30 分钟宽。
 *              轨道与 +N 走唯一 `packLanes`（日级单探针 `[0,47]`）。
 *              仅 `endAt`（无 `startAt`）→ 全天行；仅 `startAt` / 皆无 → 不进日视图（A4′）。
 */

/** 列数（每列 30 分钟；00:00–23:30） */
export const DAY_COLUMNS = 48
/** 单列分钟数 */
const COLUMN_MINUTES = 30
/** 全天分钟数 */
const DAY_MINUTES = 1440
/** 渲染最小条宽（1 列 = 30 分钟；时长 0/1 分钟被抬到该值） */
const MIN_SPAN_MIN = 30

/** 时间轴列头 */
export type DayColumn = { index: number; label: string }

/** 时间轴任务段（闭区间分数列；`isStart/isEnd` 为该任务真实起/止于本视图内） */
export type DayTimedSegment = {
    task: TaskViewObject
    colStart: number
    colEnd: number
    lane: number
    isStart: boolean
    isEnd: boolean
}

/** 日视图网格模型（§5.7 冻结契约） */
export type DayGridModel = {
    anchorKey: string
    columns: DayColumn[]
    timed: DayTimedSegment[]
    allDay: TaskViewObject[]
    overflow: { key: string; count: number }[]
    isToday: boolean
}

// 48 列：偶数列（整点 HH:00）显示两位小时，奇数列（HH:30）不显示文本
const buildColumns = (): DayColumn[] =>
    Array.from({ length: DAY_COLUMNS }, (_, index) => ({
        index,
        label: index % 2 === 0 ? String(index / 2).padStart(2, '0') : ''
    }))

/**
 * 构建日视图模型
 * @param anchorKey 锚点日键（YYYY-MM-DD）
 * @param tasks 任务快照（入参顺序＝用户排序；同起点保持该顺序）
 * @param maxLanes 可视轨道数（超出计 `+N`）
 * @param todayKey 今天日期键（注入，便于测试；不读取真实时钟）
 */
export const buildDayGrid = (
    anchorKey: string,
    tasks: TaskViewObject[],
    maxLanes: number = MAX_VISIBLE_LANES,
    todayKey: string = todayDateKey()
): DayGridModel => {
    const dayStart = dayjs(anchorKey).startOf('day')
    const dayStartMs = dayStart.valueOf()
    const dayEndMs = dayStart.add(1, 'day').valueOf()

    const allDay: TaskViewObject[] = []
    const timedItems: {
        task: TaskViewObject
        colStart: number
        colEnd: number
        isStart: boolean
        isEnd: boolean
    }[] = []

    for (const task of tasks) {
        const start = task.startAt ? dayjs(task.startAt) : null
        const end = task.endAt ? dayjs(task.endAt) : null
        const hasStart = !!start?.isValid()
        const hasEnd = !!end?.isValid()

        // 两者皆无 → 不占任何日期
        if (!hasStart && !hasEnd) continue

        // 仅 endAt（R1 归属截止日当日）→ 全天行；非锚点日不归属
        if (!hasStart && hasEnd) {
            if (end!.format('YYYY-MM-DD') === anchorKey) allDay.push(task)
            continue
        }

        // 仅 startAt（无 endAt）→ 不进日视图（A4′ / D1(b)）
        if (hasStart && !hasEnd) continue

        const startMs = start!.valueOf()
        const endMs = end!.valueOf()
        if (endMs < startMs) continue // 领域防御：非法区间不渲染

        // 跨日裁剪后覆盖整天 → 全天行（不进时间轴 / +N）
        if (startMs <= dayStartMs && endMs >= dayEndMs) {
            allDay.push(task)
            continue
        }
        // 与锚点日无交集 → 不属当日
        if (endMs <= dayStartMs || startMs >= dayEndMs) continue

        const startMin = Math.max(0, (startMs - dayStartMs) / 60000)
        const endMinRaw = Math.min(DAY_MINUTES, (endMs - dayStartMs) / 60000)
        // 时长 0/1 分钟 → 抬到最小 1 列宽（MIN_SPAN 仅渲染侧，不入领域）
        const endMin = Math.max(endMinRaw, startMin + MIN_SPAN_MIN)
        timedItems.push({
            task,
            colStart: startMin / COLUMN_MINUTES,
            colEnd: endMin / COLUMN_MINUTES - 1,
            isStart: startMs >= dayStartMs,
            isEnd: endMs <= dayEndMs
        })
    }

    // 轨道打包 + 日级单探针 +N（唯一实现 packLanes）
    const { packed, overflow } = packLanes(timedItems, maxLanes, [
        { key: anchorKey, colStart: 0, colEnd: DAY_COLUMNS - 1 }
    ])
    const timed: DayTimedSegment[] = packed.map((item) => ({
        task: item.task,
        colStart: item.colStart,
        colEnd: item.colEnd,
        lane: item.lane,
        isStart: item.isStart,
        isEnd: item.isEnd
    }))

    return {
        anchorKey,
        columns: buildColumns(),
        timed,
        allDay,
        overflow,
        isToday: anchorKey === todayKey
    }
}