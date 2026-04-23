import type { Go } from '@nao-todo/types'
import dayjs from 'dayjs'

const rules = [
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().startOf('y')), fmt: 'YYYY年M月D日, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().startOf('m')), fmt: 'M月D日, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().startOf('w')), fmt: '上周, M月D日, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().startOf('d')), fmt: 'HH:mm' },
    {
        checker: (d: dayjs.Dayjs) => d.isSame(dayjs().subtract(1, 'd'), 'd'),
        fmt: '昨天, HH:mm'
    },
    { checker: (d: dayjs.Dayjs) => d.isSame(dayjs(), 'd'), fmt: '今天, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isSame(dayjs().add(1, 'd'), 'd'), fmt: '明天, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isSame(dayjs().add(2, 'd'), 'd'), fmt: '后天, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().add(1, 'w').endOf('w')), fmt: '下周, M月D日, HH:mm' },
    { checker: (d: dayjs.Dayjs) => d.isBefore(dayjs().add(1, 'm').endOf('m')), fmt: 'M月D日, HH:mm' }
]

const date2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs): Go<string> => {
    // 1. 解析日期字符串或 dayjs 对象
    const date = typeof dateStrOrDayJs === 'string' ? dayjs(dateStrOrDayJs) : dateStrOrDayJs
    // 2. 判断日期是否有效
    if (!date?.isValid()) return [null, '无效日期']
    // 3. 解析成相对日期
    for (const rule of rules) {
        if (rule.checker(date)) {
            return [`${date.format(rule.fmt)}`, null]
        }
    }
    return [date.format('YYYY年M月D日, HH:mm'), null]
}

export const parse2RelativeDate = (dateStrOrDayJs: string | dayjs.Dayjs) => {
    const [relativeDate, error] = date2RelativeDate(dateStrOrDayJs)
    if (error) return null
    return relativeDate
}

export default date2RelativeDate
