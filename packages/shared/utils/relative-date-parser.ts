import type { Go } from '../types'
import dayjs from 'dayjs'
import { t, type LocaleKey } from '../locales'

/**
 * 相对日期规则（文案经 t() 本地化，周名取自 date.weekday.* key）
 */
type Rule = {
    check: (date: dayjs.Dayjs, _nowDayjs: dayjs.Dayjs) => boolean
    format: (date: dayjs.Dayjs) => string
}

/** 本地化周名（date.weekday.0 为周日） */
const weekdayName = (d: dayjs.Dayjs): string => t(`date.weekday.${d.day()}` as LocaleKey)

/**
 * 相对日期规则
 */
const rules: Rule[] = [
    // 今天
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'd'),
        format: (d) => t('date.today', { time: d.format('HH:mm') })
    },
    // 昨天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const yesterdayStart = _nowDayjs.subtract(1, 'd').startOf('day')
            const yesterdayEnd = _nowDayjs.subtract(1, 'd').endOf('day')
            return d.isAfter(yesterdayStart) && d.isBefore(yesterdayEnd)
        },
        format: (d) => t('date.yesterday', { time: d.format('HH:mm') })
    },
    // 明天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const tomorrowStart = _nowDayjs.add(1, 'd').startOf('day')
            const tomorrowEnd = _nowDayjs.add(1, 'd').endOf('day')
            return d.isAfter(tomorrowStart) && d.isBefore(tomorrowEnd)
        },
        format: (d) => t('date.tomorrow', { time: d.format('HH:mm') })
    },
    // 后天
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'd')) return false
            const dayAfterTomorrowStart = _nowDayjs.add(2, 'd').startOf('day')
            const dayAfterTomorrowEnd = _nowDayjs.add(2, 'd').endOf('day')
            return d.isAfter(dayAfterTomorrowStart) && d.isBefore(dayAfterTomorrowEnd)
        },
        format: (d) => t('date.dayAfterTomorrow', { time: d.format('HH:mm') })
    },
    // 本周
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'w'),
        format: (d) => t('date.thisWeek', { weekday: weekdayName(d), time: d.format('HH:mm') })
    },
    // 上周
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'w')) return false
            const lastWeekStart = _nowDayjs.subtract(1, 'w').startOf('week')
            const lastWeekEnd = _nowDayjs.subtract(1, 'w').endOf('week')
            return d.isAfter(lastWeekStart) && d.isBefore(lastWeekEnd)
        },
        format: (d) => t('date.lastWeek', { weekday: weekdayName(d), time: d.format('HH:mm') })
    },
    // 下周
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'w')) return false
            const nextWeekStart = _nowDayjs.add(1, 'w').startOf('week')
            const nextWeekEnd = _nowDayjs.add(1, 'w').endOf('week')
            return d.isAfter(nextWeekStart) && d.isBefore(nextWeekEnd)
        },
        format: (d) => t('date.nextWeek', { weekday: weekdayName(d), time: d.format('HH:mm') })
    },
    // 本月
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'month'),
        format: (d) => t('date.thisMonth', { day: d.date(), time: d.format('HH:mm') })
    },
    // 上个月
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'month')) return false
            const lastMonthStart = _nowDayjs.subtract(1, 'month').startOf('month')
            const lastMonthEnd = _nowDayjs.subtract(1, 'month').endOf('month')
            return d.isAfter(lastMonthStart) && d.isBefore(lastMonthEnd)
        },
        format: (d) => t('date.lastMonth', { day: d.date(), time: d.format('HH:mm') })
    },
    // 下个月
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'month')) return false
            const nextMonthStart = _nowDayjs.add(1, 'month').startOf('month')
            const nextMonthEnd = _nowDayjs.add(1, 'month').endOf('month')
            return d.isAfter(nextMonthStart) && d.isBefore(nextMonthEnd)
        },
        format: (d) => t('date.nextMonth', { day: d.date(), time: d.format('HH:mm') })
    },
    // 今年
    {
        check: (d, _nowDayjs) => d.isSame(_nowDayjs, 'y'),
        format: (d) =>
            t('date.thisYear', {
                month: d.month() + 1,
                day: d.date(),
                time: d.format('HH:mm')
            })
    },
    // 去年
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'y')) return false
            const lastYearStart = _nowDayjs.subtract(1, 'y').startOf('day')
            const lastYearEnd = _nowDayjs.subtract(1, 'y').endOf('day')
            return d.isAfter(lastYearStart) && d.isBefore(lastYearEnd)
        },
        format: (d) =>
            t('date.lastYear', {
                month: d.month() + 1,
                day: d.date(),
                time: d.format('HH:mm')
            })
    },
    // 明年
    {
        check: (d, _nowDayjs) => {
            if (d.isSame(_nowDayjs, 'y')) return false
            const nextYearStart = _nowDayjs.add(1, 'y').startOf('day')
            const nextYearEnd = _nowDayjs.add(1, 'y').endOf('day')
            return d.isAfter(nextYearStart) && d.isBefore(nextYearEnd)
        },
        format: (d) =>
            t('date.nextYear', {
                month: d.month() + 1,
                day: d.date(),
                time: d.format('HH:mm')
            })
    }
]

/**
 * @description 将日期字符串或 dayjs 对象转换为相对日期字符串
 * @param dateStrOrDayJs 日期字符串或 dayjs 对象
 * @returns 相对日期字符串（经 t() 本地化）
 * @throws 无效日期
 */
const date2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs): Go<string> => {
    const date = typeof dateStrOrDayJs === 'string' ? dayjs(dateStrOrDayJs) : dateStrOrDayJs
    if (!date?.isValid()) return [null, t('date.invalid')]
    const _nowDayjs = dayjs()
    for (const rule of rules) {
        if (!rule.check(date, _nowDayjs)) continue
        return [rule.format(date), null]
    }
    return [date.format(t('date.fallbackFormat')), null]
}

/**
 * @description 解析日期字符串或 dayjs 对象为相对日期字符串
 * @param dateStrOrDayJs 日期字符串或 dayjs 对象
 * @returns 相对日期字符串；无效日期返回 null
 */
export const parse2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs) => {
    const [relativeDate, error] = date2RelativeDate(dateStrOrDayJs)
    if (error) return null
    return relativeDate
}

export default date2RelativeDate