import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task/viewobjects'

/**
 * 判断是否是今天
 * @param m 日期对象
 * @return 是否是今天
 */
export const isToday = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs(), 'day')
}

/**
 * 判断是否是明天
 * @param m 日期对象
 * @return 是否是明天
 */
export const isTomorrow = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs().add(1, 'day'), 'day')
}

/**
 * 判断是否是昨天
 * @param m 日期对象
 * @return 是否是昨天
 */
export const isYesterday = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs().subtract(1, 'day'), 'day')
}

/**
 * 判断是否在7天内
 * @param m 日期对象
 * @return 是否在7天内
 */
export const isIn7DaysFromNow = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().subtract(7, 'days')) && m.isBefore(dayjs().add(1, 'day'))
}

/**
 * 判断是否在30天内
 * @param m 日期对象
 * @return 是否在30天内
 */
export const isIn30DaysFromNow = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().subtract(30, 'days')) && m.isBefore(dayjs().add(1, 'day'))
}

/**
 * 判断是否在本年
 * @param m 日期对象
 * @return 是否在本年
 */
export const isAfterThisYear = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().endOf('year'))
}

/**
 * 判断是否过期
 * @param date 日期对象或字符串
 * @return 是否过期
 */
export const isExpired = (date: dayjs.Dayjs | string | null) => {
    if (typeof date === 'string') date = dayjs(date)
    if (!date) return false
    return date.isBefore(dayjs())
}

/**
 * 判断待办任务是否过期
 * @param task 待办任务对象
 * @return 是否过期（超过结束时间且未完成）
 */
export const isTaskExpired = (task: TaskViewObject) => {
    const now = dayjs()
    const endAt = dayjs(task.endAt)
    return now.isAfter(endAt) && task.state !== 'done'
}

/**
 * 格式化日期为 datetime input 格式
 * @param m 日期对象
 * @return 格式化后的日期字符串
 */
export const formatForDateTimeInput = (m: dayjs.Dayjs) => {
    return m.format('YYYY-MM-DDTHH:mm')
}
