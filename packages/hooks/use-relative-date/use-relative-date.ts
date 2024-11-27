import {
    isToday,
    isTomorrow,
    isYesterday,
    isIn7DaysFromNow,
    isIn30DaysFromNow,
    isAfterThisYear
} from '@nao-todo/utils/date'
import { useMoment } from '@nao-todo/utils/date'
import type { Moment } from 'moment'

const oldDate = null
const oldRelativeDate = ''

const useRelativeDate = (date: Moment | Date | string | null) => {
    if (date === null) return '-'
    if (date === oldDate) return oldRelativeDate
    if (date instanceof Date || typeof date === 'string') date = useMoment(date)

    if (isYesterday(date)) return `昨天, ${date.format('HH:mm')}`
    if (isToday(date)) return `今天, ${date.format('HH:mm')}`
    if (isTomorrow(date)) return `明天, ${date.format('HH:mm')}`
    if (isIn7DaysFromNow(date)) {
        const weekdayString = '日一二三四五六'
        const weekday = `周${weekdayString[date.day()]}`
        if (date.isSame(useMoment(), 'year')) {
            return `${weekday}, ${date.format('M月D日, HH:mm')}`
        }
        return `${weekday}, ${date.format('YYYY年MM月DD日, HH:mm')}`
    }
    if (isIn30DaysFromNow(date)) {
        return `${date.format('M月D日, HH:mm')}`
    }
    if (isAfterThisYear(date)) {
        return `${date.format('YYYY年M月D日, HH:mm')}`
    }

    return `${date.fromNow()}`
}

export default useRelativeDate
