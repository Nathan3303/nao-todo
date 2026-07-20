import type { Go } from '../types'
import dayjs from 'dayjs'

/**
 * 星期几名称
 */
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 相对日期规则
 */
type Rule = {
    check: (date: dayjs.Dayjs, _nowDayjs: dayjs.Dayjs) => boolean
    format: (date: dayjs.Dayjs) => string
}

/**
 * 相对日期规则
 */
const rules: Rule[] = [
    // 今天
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'd'),
        format: (d) => d.format('今天 HH:mm')
    },
    // 昨天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const yesterdayStart = _nowDayjs.subtract(1, 'd').startOf('day')
            const yesterdayEnd = _nowDayjs.subtract(1, 'd').endOf('day')
            return d.isAfter(yesterdayStart) && d.isBefore(yesterdayEnd)
        },
        format: (d) => d.format('昨天 HH:mm')
    },
    // 明天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const tomorrowStart = _nowDayjs.add(1, 'd').startOf('day')
            const tomorrowEnd = _nowDayjs.add(1, 'd').endOf('day')
            return d.isAfter(tomorrowStart) && d.isBefore(tomorrowEnd)
        },
        format: (d) => d.format('明天 HH:mm')
    },
    // 后天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const dayAfterTomorrowStart = _nowDayjs.add(2, 'd').startOf('day')
            const dayAfterTomorrowEnd = _nowDayjs.add(2, 'd').endOf('day')
            return d.isAfter(dayAfterTomorrowStart) && d.isBefore(dayAfterTomorrowEnd)
        },
        format: (d) => d.format('后天 HH:mm')
    },
    // 本周
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'w'),
        format: (d) => d.format(`周${WEEKDAY_NAMES[d.day()]} HH:mm`)
    },
    // 上周
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'w')) return false
            const lastWeekStart = _nowDayjs.subtract(1, 'w').startOf('week')
            const lastWeekEnd = _nowDayjs.subtract(1, 'w').endOf('week')
            return d.isAfter(lastWeekStart) && d.isBefore(lastWeekEnd)
        },
        format: (d) => d.format(`上周${WEEKDAY_NAMES[d.day()]} HH:mm`)
    },
    // 下周
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'w')) return false
            const nextWeekStart = _nowDayjs.add(1, 'w').startOf('week')
            const nextWeekEnd = _nowDayjs.add(1, 'w').endOf('week')
            return d.isAfter(nextWeekStart) && d.isBefore(nextWeekEnd)
        },
        format: (d) => d.format(`下周${WEEKDAY_NAMES[d.day()]} HH:mm`)
    },
    // 本月
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'month'),
        format: (d) => d.format('本月D日 HH:mm')
    },
    // 上个月
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'month')) return false
            const lastMonthStart = _nowDayjs.subtract(1, 'month').startOf('month')
            const lastMonthEnd = _nowDayjs.subtract(1, 'month').endOf('month')
            return d.isAfter(lastMonthStart) && d.isBefore(lastMonthEnd)
        },
        format: (d) => d.format('上个月D日 HH:mm')
    },
    // 下个月
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'month')) return false
            const nextMonthStart = _nowDayjs.add(1, 'month').startOf('month')
            const nextMonthEnd = _nowDayjs.add(1, 'month').endOf('month')
            return d.isAfter(nextMonthStart) && d.isBefore(nextMonthEnd)
        },
        format: (d) => d.format('下个月D日 HH:mm')
    },
    // 今年
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'y'),
        format: (d) => d.format('M月D日 HH:mm')
    },
    // 去年
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'y')) return false
            const lastYearStart = _nowDayjs.subtract(1, 'y').startOf('day')
            const lastYearEnd = _nowDayjs.subtract(1, 'y').endOf('day')
            return d.isAfter(lastYearStart) && d.isBefore(lastYearEnd)
        },
        format: (d) => d.format('去年M月D日 HH:mm')
    },
    // 明年
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'y')) return false
            const nextYearStart = _nowDayjs.add(1, 'y').startOf('day')
            const nextYearEnd = _nowDayjs.add(1, 'y').endOf('day')
            return d.isAfter(nextYearStart) && d.isBefore(nextYearEnd)
        },
        format: (d) => d.format('明年M月D日 HH:mm')
    }
]

/**
 * @description 将日期字符串或 dayjs 对象转换为相对日期字符串
 * @example
 * date2RelativeDate('2023-12-31 12:00')
 * // '下周 2023年12月31日 12:00'
 * @example
 * date2RelativeDate('2023-12-31 12:00')
 * // '下周 2023年12月31日 12:00'
 * @param dateStrOrDayJs 日期字符串或 dayjs 对象
 * @returns 相对日期字符串
 * @throws 无效日期
 */
const date2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs): Go<string> => {
    const date = typeof dateStrOrDayJs === 'string' ? dayjs(dateStrOrDayJs) : dateStrOrDayJs
    if (!date?.isValid()) return [null, '无效日期']
    const _nowDayjs = dayjs()
    for (const rule of rules) {
        if (!rule.check(date, _nowDayjs)) continue
        return [rule.format(date), null]
    }
    return [date.format('YYYY年M月D日 HH:mm'), null]
}

/**
 * @description 解析日期字符串或 dayjs 对象为相对日期字符串
 * @example
 * parse2RelativeDate('2023-12-31 12:00')
 * // '下周 2023年12月31日 12:00'
 * @param dateStrOrDayJs 日期字符串或 dayjs 对象
 * @returns 相对日期字符串
 * @throws 无效日期
 */
export const parse2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs) => {
    const [relativeDate, error] = date2RelativeDate(dateStrOrDayJs)
    if (error) return null
    return relativeDate
}

export default date2RelativeDate


