import dayjs from 'dayjs'
import { dateKeyOf, type CalendarRow, type CalendarSegment } from './monthly-layout'

/**
 * 任务条段末截止时刻可见性纯函数模块
 * @description TASK-11：时刻由段首开始时刻改为段末截止时刻，仅在「真末段且末段落在
 *              endAt 当日」时显示。与 UI 解耦，月/周视图各自引用对应判定，便于纯单测。
 */

/**
 * 月视图：段是否显示截止时刻
 * @description 仅真末段（isEnd），且该段结束列所在日期 = endAt 当日；
 *              跨行续接/裁剪得到的非末段不显示。
 */
export const showEndTimeInMonth = (seg: CalendarSegment, row: CalendarRow): boolean => {
    const task = seg.task
    return !!seg.isEnd && !!task.endAt && row.cells[seg.colEnd]?.dateKey === dateKeyOf(task.endAt)
}

/**
 * 周视图：段是否显示截止时刻
 * @description 仅真末段（isEnd）且 endAt 合法；任务延续到本周之外（非末段）不显示。
 */
export const showEndTimeInWeek = (seg: CalendarSegment): boolean =>
    !!seg.isEnd && !!seg.task.endAt && dayjs(seg.task.endAt).isValid()