import type { Go } from '@nao-todo/types'
import dayjs from 'dayjs'

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

type Rule = {
    check: (
        date: dayjs.Dayjs,
        refs: {
            today: dayjs.Dayjs
            yesterday: dayjs.Dayjs
            tomorrow: dayjs.Dayjs
            dayAfterTomorrow: dayjs.Dayjs
            thisWeekStart: dayjs.Dayjs
            thisMonthStart: dayjs.Dayjs
            thisYearStart: dayjs.Dayjs
            nextWeekEnd: dayjs.Dayjs
            nextMonthEnd: dayjs.Dayjs
        }
    ) => boolean
    format: (date: dayjs.Dayjs) => string
}

/**
 * 相对日期规则
 */
const rules: Rule[] = [
    {
        check: (d, { today }) => d.isSame(today, 'd'),
        format: (d) => `今天 ${d.format('HH:mm')}`
    },
    {
        check: (d, { yesterday }) => d.isSame(yesterday, 'd'),
        format: (d) => `昨天 ${d.format('HH:mm')}`
    },
    {
        check: (d, { tomorrow }) => d.isSame(tomorrow, 'd'),
        format: (d) => `明天 ${d.format('HH:mm')}`
    },
    {
        check: (d, { dayAfterTomorrow }) => d.isSame(dayAfterTomorrow, 'd'),
        format: (d) => `后天 ${d.format('HH:mm')}`
    },
    {
        check: (d, { thisWeekStart }) => d.isBefore(thisWeekStart),
        format: (d) => `上周${WEEKDAY_NAMES[d.day()]} ${d.format('HH:mm')}`
    },
    {
        check: (d, { thisMonthStart }) => d.isBefore(thisMonthStart),
        format: (d) => d.format('M月D日 HH:mm')
    },
    {
        check: (d, { thisYearStart }) => d.isBefore(thisYearStart),
        format: (d) => d.format('M月D日 HH:mm')
    },
    {
        check: (d, { nextWeekEnd }) => d.isBefore(nextWeekEnd),
        format: (d) => `下周${WEEKDAY_NAMES[d.day()]} ${d.format('HH:mm')}`
    },
    {
        check: (d, { nextMonthEnd }) => d.isBefore(nextMonthEnd),
        format: (d) => d.format('M月D日 HH:mm')
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
    const now = dayjs()
    const refs = {
        today: now.startOf('d'),
        yesterday: now.startOf('d').subtract(1, 'd'),
        tomorrow: now.startOf('d').add(1, 'd'),
        dayAfterTomorrow: now.startOf('d').add(2, 'd'),
        thisWeekStart: now.startOf('w'),
        thisMonthStart: now.startOf('m'),
        thisYearStart: now.startOf('y'),
        nextWeekEnd: now.add(1, 'w').endOf('w'),
        nextMonthEnd: now.add(1, 'm').endOf('m')
    }
    for (const rule of rules) {
        if (rule.check(date, refs)) {
            return [rule.format(date), null]
        }
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

