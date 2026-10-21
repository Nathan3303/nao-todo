import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { packLanes } from '../lane-packing'
import { MAX_VISIBLE_LANES, todayDateKey } from '../monthly/monthly-layout'
import { DAY_SNAP_MINUTES } from '../snap'

/**
 * 日视图模型（PRD §5.1–§5.4 / §5.7 冻结契约；ADR C2–C3 / C11 / C13；TASK-19 档位参数化 C2/C4）
 * @description 时间轴列数由**档位粒度**决定（`1440 / columnMinutes`，默认 30min ⇒ 48 列）；任务按**真实 `startAt/endAt`**
 *              折算为分钟级分数列（`colStart=startMin/columnMinutes`、`colEnd=endMin/columnMinutes−1`，
 *              闭区间、连续不吸附）；跨日裁剪到当日并以 `isStart/isEnd` 标记续接；时长为 0 → 最小 30 分钟宽。
 *              轨道与 +N 走唯一 `packLanes`（日级单探针 `[0, columns−1]`）。
 *              仅 `endAt`（无 `startAt`）→ 全天行；仅 `startAt` / 皆无 → 不进日视图（A4′）。
 */

/** 全天分钟数 */
const DAY_MINUTES = 1440
/** 渲染最小条宽（分钟；不随档位变，10min 档自动为 3 列；C2） */
export const MIN_SPAN_MIN = DAY_SNAP_MINUTES

/** 轴粒度（列宽基准；C2：`30 % columnMinutes === 0`；r2 枚举 {30,15,5}） */
export type DayGeometry = { columnMinutes: 30 | 15 | 5 }

/** 时间轴列头 */
export type DayColumn = { index: number; label: string }

/**
 * 轴端点（R1 / R6：端点语义进模型，CSS 不写端点魔数）
 * @property key `start` = 00:00 轴起点；`end` = 24:00 轴终点
 * @property minutes 端点分钟值（0 / 1440；终点不折回次日 00:00）
 * @property label 端标签文本（型式随档位：×1 / ×1.5 ⇒ `00` / `24`；×2 以上 ⇒ `00:00` / `24:00`）
 * @property labelIndex 端标签承载列（起点 = 首列；终点 = 末列，标签右对齐于轴终点）
 */
export type DayAxisEndpoint = {
    key: 'start' | 'end'
    minutes: number
    label: string
    labelIndex: number
}

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
    axisEndpoints: DayAxisEndpoint[]
    timed: DayTimedSegment[]
    allDay: TaskViewObject[]
    overflow: { key: string; count: number }[]
    isToday: boolean
}

/**
 * 轴标签文本（**单一来源**：内部列头与轴端点共用；D1.1 分档两式）
 * @description 30min 档 ⇒ `HH`（调用方保证整点）；15/5min 档 ⇒ `HH:MM`。
 *              `minutes = 1440` ⇒ `24` / `24:00`（轴终点，不折回次日 `00`）。
 */
const formatAxisLabel = (minutes: number, columnMinutes: 30 | 15 | 5): string => {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
    if (columnMinutes === 30) return hour
    return `${hour}:${String(minutes % 60).padStart(2, '0')}`
}

// 列头标签两型（D1.1 分档两式）：30min 档仅整点 `HH`（24 个，与现状逐字节一致）；
// 15/5min 档整点 + 半点 `HH:MM`（48 个）；其余列为空（端点标签另由 `axisEndpoints` 承载）。
const buildColumns = (columnMinutes: 30 | 15 | 5): DayColumn[] => {
    const columns = DAY_MINUTES / columnMinutes
    return Array.from({ length: columns }, (_, index) => {
        const minutes = index * columnMinutes
        if (columnMinutes === 30) {
            return {
                index,
                label: minutes % 60 === 0 ? formatAxisLabel(minutes, columnMinutes) : ''
            }
        }
        if (minutes % 30 !== 0) return { index, label: '' }
        return { index, label: formatAxisLabel(minutes, columnMinutes) }
    })
}

/**
 * 轴端点（R1 / R6）：00:00 与 24:00 是时间轴的**物理端点**，与「整点 / 半点」内部刻度是两类语义
 * @description 端点恒存在（不依赖标签生成规则）；末端点落在**轴终点**（末列右缘），
 *              故末标签不再是 `23:30` 之后的空白（DEF-78 现状 B）。
 */
const buildAxisEndpoints = (columnMinutes: 30 | 15 | 5, columns: number): DayAxisEndpoint[] => [
    { key: 'start', minutes: 0, label: formatAxisLabel(0, columnMinutes), labelIndex: 0 },
    {
        key: 'end',
        minutes: DAY_MINUTES,
        label: formatAxisLabel(DAY_MINUTES, columnMinutes),
        labelIndex: columns - 1
    }
]

/**
 * 构建日视图模型
 * @param anchorKey 锚点日键（YYYY-MM-DD）
 * @param tasks 任务快照（入参顺序＝用户排序；同起点保持该顺序）
 * @param maxLanes 可视轨道数（超出计 `+N`；日视图传 `Infinity` ⇒ 全部渲染，D4/V1）
 * @param todayKey 今天日期键（注入，便于测试；不读取真实时钟）
 * @param geometry 轴粒度（追加式参数；默认 30min ⇒ 48 列，既有调用不变）
 */
export const buildDayGrid = (
    anchorKey: string,
    tasks: TaskViewObject[],
    maxLanes: number = MAX_VISIBLE_LANES,
    todayKey: string = todayDateKey(),
    geometry: DayGeometry = { columnMinutes: 30 }
): DayGridModel => {
    const columnMinutes = geometry.columnMinutes
    const columns = DAY_MINUTES / columnMinutes
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
            colStart: startMin / columnMinutes,
            colEnd: endMin / columnMinutes - 1,
            isStart: startMs >= dayStartMs,
            isEnd: endMs <= dayEndMs
        })
    }

    // 轨道打包 + 日级单探针 +N（唯一实现 packLanes；探针 colEnd = columns − 1，C3）
    const { packed, overflow } = packLanes(timedItems, maxLanes, [
        { key: anchorKey, colStart: 0, colEnd: columns - 1 }
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
        columns: buildColumns(columnMinutes),
        axisEndpoints: buildAxisEndpoints(columnMinutes, columns),
        timed,
        allDay,
        overflow,
        isToday: anchorKey === todayKey
    }
}