import type { CalendarWeekStart } from './monthly-layout'
import { weekStartKeyOf } from './monthly-layout'

/**
 * C2-F9 标题年月跳转 - 纯逻辑模块
 * @description 与 UI 解耦的年-月面板辅助：月格/年偏移、目标月 1 号日期键、
 *              含 1 号周的周起点（weekStart 口径边界）、原选中日是否落在目标月（保留/清除判定）。
 */

/** 两位补零 */
export const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 月格值（1~12） */
export const MONTH_VALUES: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** 年偏移（面板年上/下箭头） */
export const offsetYear = (year: number, delta: number): number => year + delta

/** 目标年月 1 号日期键（YYYY-MM-01） */
export const monthFirstDateKey = (year: number, month: number): string =>
    `${year}-${pad2(month)}-01`

/** 含某年月 1 号的周起点日期键（weekStart 口径；可能落入上月） */
export const weekStartKeyOfMonthFirst = (
    year: number,
    month: number,
    weekStart: CalendarWeekStart
): string => weekStartKeyOf(monthFirstDateKey(year, month), weekStart)

/** 日期键是否落在目标年月（月视图跳转"原选中保留/清除"判定） */
export const isDateKeyInMonth = (dateKey: string, year: number, month: number): boolean =>
    dateKey.startsWith(`${year}-${pad2(month)}-`)