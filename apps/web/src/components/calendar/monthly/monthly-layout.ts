import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 月历布局纯函数模块
 * @description 与 UI 解耦的日期/任务分段计算：
 *              1. 生成 6 行 7 列的月网格（周日开头，与既有视觉一致）；
 *              2. 按业务规则 R1 把任务折算为 [startAt日, endAt日] 闭区间跨度；
 *              3. 按行拆段（R2 跨行续接）并分配轨道（lane），同一天不重叠；
 *              4. 统计每个日期格超出可视轨道上限的任务数（R5 溢出 +N）。
 */

// 网格常量（月历固定 6 行 = 42 格）
export const GRID_COLUMNS = 7
export const GRID_ROWS = 6
export const GRID_TOTAL = GRID_COLUMNS * GRID_ROWS

// 每格最多直接渲染的任务轨道数，超出部分以 "+N" 折叠
export const MAX_VISIBLE_LANES = 3

/** 月份归属：-1 上个月 / 0 本月 / 1 下个月 */
export type CalendarMonthOffset = -1 | 0 | 1

/** 单个日期格 */
export type CalendarDayCell = {
    cell: number // 0..41 全网格序号
    dateKey: string // YYYY-MM-DD
    day: number // 日号
    monthOffset: CalendarMonthOffset
    isToday: boolean
    isSelected: boolean
    isWeekend: boolean
}

/** 任务的日期跨度（已按 R1 折算） */
export type CalendarTaskSpan = {
    taskId: TaskViewObject['id']
    startKey: string
    endKey: string
}

/** 某一行内的一段连续渲染段（跨行任务会被拆成多段） */
export type CalendarSegment = {
    task: TaskViewObject
    colStart: number // 0..6 该行内起始列
    colEnd: number // 0..6 该行内结束列
    lane: number // 轨道序号（0 起）
    isStart: boolean // 是该任务在网格中的首段（左侧圆角）
    isEnd: boolean // 是该任务在网格中的末段（右侧圆角）
}

/** 日期格溢出信息（+N） */
export type CalendarOverflow = {
    cell: number
    dateKey: string
    count: number
}

/** 一周（一行） */
export type CalendarRow = {
    row: number
    cells: CalendarDayCell[]
    segments: CalendarSegment[]
    overflow: CalendarOverflow[]
}

/** 完整月网格模型 */
export type CalendarGridModel = {
    year: number
    monthIndex: number // 0-based
    cells: CalendarDayCell[]
    rows: CalendarRow[]
    firstKey: string
    lastKey: string
}

const fmtKey = (d: dayjs.Dayjs): string => d.format('YYYY-MM-DD')

/** 任意可解析时间 -> YYYY-MM-DD */
export const dateKeyOf = (value: string | Date | number): string => fmtKey(dayjs(value))

/** 今天的日期键 */
export const todayDateKey = (): string => fmtKey(dayjs())

/**
 * 解析单个任务的时间归属
 * @description R1：startAt+endAt -> [startAt日, endAt日] 闭区间；
 *              仅 endAt -> 截止日当天；仅 startAt / 无日期 -> null（不占格子）。
 */
export const buildTaskSpan = (task: TaskViewObject): CalendarTaskSpan | null => {
    const start = dayjs(task.startAt)
    const end = dayjs(task.endAt)
    const hasStart = !!task.startAt && start.isValid()
    const hasEnd = !!task.endAt && end.isValid()
    if (hasStart && hasEnd) {
        // 领域规则保证 start <= end，这里做一次防御
        if (start.isAfter(end, 'day')) return null
        return { taskId: task.id, startKey: fmtKey(start), endKey: fmtKey(end) }
    }
    if (hasEnd) {
        const key = fmtKey(end)
        return { taskId: task.id, startKey: key, endKey: key }
    }
    return null
}

/** 两个字符串日期键（YYYY-MM-DD）的大小比较 */
const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * 生成月网格模型
 * @param year 年份
 * @param monthIndex 月份（0-based）
 * @param tasks 参与渲染的任务（可含其他月份，内部按跨度裁剪）
 * @param selectedKey 当前选中日期键
 */
export const buildGridModel = (
    year: number,
    monthIndex: number,
    tasks: TaskViewObject[],
    selectedKey?: string | null
): CalendarGridModel => {
    const firstOfMonth = dayjs(new Date(year, monthIndex, 1))
    // 周日开头：从本月 1 号所在周的周日开始铺 42 格
    const gridStart = firstOfMonth.subtract(firstOfMonth.day(), 'day')
    const todayKey = todayDateKey()
    const targetKey = selectedKey || ''

    const cells: CalendarDayCell[] = []
    for (let i = 0; i < GRID_TOTAL; i++) {
        const date = gridStart.add(i, 'day')
        const key = fmtKey(date)
        cells.push({
            cell: i,
            dateKey: key,
            day: date.date(),
            monthOffset: date.month() < monthIndex ? -1 : date.month() > monthIndex ? 1 : 0,
            isToday: key === todayKey,
            isSelected: !!targetKey && key === targetKey,
            isWeekend: date.day() === 0 || date.day() === 6
        })
    }

    // R1 折算任务跨度（保留原始输入顺序，排序算法为稳定排序）
    const spans = tasks.map(buildTaskSpan).filter((s): s is CalendarTaskSpan => !!s)

    const rows: CalendarRow[] = []
    for (let r = 0; r < GRID_ROWS; r++) {
        const rowCells = cells.slice(r * GRID_COLUMNS, (r + 1) * GRID_COLUMNS)
        const rowStartKey = rowCells[0]!.dateKey
        const rowEndKey = rowCells[GRID_COLUMNS - 1]!.dateKey
        const taskBySpanId = new Map(tasks.map((t) => [t.id, t]))

        // 与该行相交的任务跨度（含跨行任务在本行的切片）
        const rowSpans = spans
            .filter(
                (s) =>
                    compareKeys(s.startKey, rowEndKey) <= 0 &&
                    compareKeys(s.endKey, rowStartKey) >= 0
            )
            .map((s) => {
                const startKey = compareKeys(s.startKey, rowStartKey) < 0 ? rowStartKey : s.startKey
                const endKey = compareKeys(s.endKey, rowEndKey) > 0 ? rowEndKey : s.endKey
                const colAt = (key: string) => rowCells.findIndex((c) => c.dateKey === key)
                return {
                    span: s,
                    colStart: colAt(startKey),
                    colEnd: colAt(endKey),
                    isStart: s.startKey === startKey,
                    isEnd: s.endKey === endKey
                }
            })
            // 早开始的在上方/左侧优先；同一开始列长的优先（贪婪轨道分配的前提）
            .sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd)

        // 贪婪分配轨道：每个 span 放入首个与其无重叠的轨道
        const laneEnds: number[][] = [] // lane -> 该轨道已占用区间的结束列
        const segments: CalendarSegment[] = []
        for (const item of rowSpans) {
            const task = taskBySpanId.get(item.span.taskId)!
            let lane = 0
            while (true) {
                const ends = laneEnds[lane]
                if (!ends || !ends.some((end) => item.colStart <= end)) break
                lane++
            }
            ;(laneEnds[lane] ??= []).push(item.colEnd)
            segments.push({
                task,
                colStart: item.colStart,
                colEnd: item.colEnd,
                lane,
                isStart: item.isStart,
                isEnd: item.isEnd
            })
        }

        // R5 溢出统计：该格内所有任务数 - 落在可视轨道内的任务数
        const overflow: CalendarOverflow[] = []
        for (const cell of rowCells) {
            const col = cell.cell % GRID_COLUMNS
            const overlapped = segments.filter((s) => s.colStart <= col && s.colEnd >= col)
            const drawn = overlapped.filter((s) => s.lane < MAX_VISIBLE_LANES).length
            const hidden = overlapped.length - drawn
            if (hidden > 0) overflow.push({ cell: cell.cell, dateKey: cell.dateKey, count: hidden })
        }

        rows.push({ row: r, cells: rowCells, segments, overflow })
    }

    return {
        year,
        monthIndex,
        cells,
        rows,
        firstKey: cells[0]!.dateKey,
        lastKey: cells[GRID_TOTAL - 1]!.dateKey
    }
}

/** 获取某日期格在行内被绘制的任务（可视轨道内），供点击命中/样式使用 */
export const segmentsOnCell = (row: CalendarRow, dateKey: string): CalendarSegment[] => {
    const col = row.cells.findIndex((c) => c.dateKey === dateKey)
    if (col < 0) return []
    return row.segments.filter(
        (s) => s.lane < MAX_VISIBLE_LANES && s.colStart <= col && s.colEnd >= col
    )
}

/** 任务跨度是否覆盖某个日期键 */
export const spanCoversDate = (task: TaskViewObject, dateKey: string): boolean => {
    const span = buildTaskSpan(task)
    if (!span) return false
    return compareKeys(span.startKey, dateKey) <= 0 && compareKeys(span.endKey, dateKey) >= 0
}