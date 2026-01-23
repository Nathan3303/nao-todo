import type { Go } from '@nao-todo/types'
import dayjs from 'dayjs'

export default (dateStrOrDayJs: string | dayjs.Dayjs): Go<string> => {
    // 1. 解析日期字符串或 dayjs 对象
    const date = typeof dateStrOrDayJs === 'string' ? dayjs(dateStrOrDayJs) : dateStrOrDayJs
    // 2. 判断日期是否有效
    if (!date.isValid()) return [null, '无效日期']
    // 3. 解析成相对日期
    if (date.isSame(dayjs().subtract(1, 'day'), 'day')) {
        return [`昨天, ${date.format('HH:mm')}`, null]
    } else if (date.isSame(dayjs(), 'day')) {
        return [`今天, ${date.format('HH:mm')}`, null]
    } else if (date.isSame(dayjs().add(1, 'day'), 'day'))
        return [`明天, ${date.format('HH:mm')}`, null]
    else if (date.isSame(dayjs().add(7, 'day'), 'day')) {
        // const weekdayString = '日一二三四五六'
        // const weekday = `周${weekdayString[date.day()]}`
        if (date.isSame(dayjs(), 'year')) {
            return [`${date.format('M月D日, HH:mm')}`, null]
        }
        return [`${date.format('YYYY年MM月DD日, HH:mm')}`, null]
    } else if (date.isSame(dayjs().add(30, 'day'), 'day')) {
        return [`${date.format('M月D日, HH:mm')}`, null]
    } else if (date.isAfter(dayjs().endOf('year'))) {
        return [`${date.format('YYYY年M月D日, HH:mm')}`, null]
    } else {
        return [null, '超出范围']
    }
}
