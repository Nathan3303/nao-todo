import moment from 'moment'
import {
    isToday,
    isTomorrow,
    isYesterday,
    isIn7DaysFromNow,
    isIn30DaysFromNow,
    isAfterThisYear
} from '@/handlers/date-handlers'
import type { Moment } from 'moment'

let oldDate = null
let oldRelativeDate = ''

moment.updateLocale('zh-CN', {
    relativeTime: {
        future: '%s后',
        past: '%s前',
        s: '1 秒',
        ss: '%d 秒',
        m: '1 分钟',
        mm: '%d 分钟',
        h: '1 小时',
        hh: '%d 小时',
        d: '1 天',
        dd: '%d 天',
        w: '1 周',
        ww: '%d 周',
        M: '1 月',
        MM: '%d 月',
        y: '1 年',
        yy: '%d 年'
    }
})

export const useRelativeDate = (date: Moment | Date | string | null) => {
    if (date === null) return '-'
    if (date === oldDate) return oldRelativeDate
    if (date instanceof Date || typeof date === 'string') {
        date = moment(date).locale('zh-CN')
    }

    if (isYesterday(date)) return `昨天, ${date.format('M月D日, HH:mm')}`
    if (isToday(date)) return `今天, ${date.format('M月D日, HH:mm')}`
    if (isTomorrow(date)) return `明天, ${date.format('M月D日, HH:mm')}`
    if (isIn7DaysFromNow(date)) {
        const weekdayString = '日一二三四五六'
        const weekday = `周${weekdayString[date.day()]}`
        if (date.isSame(moment(), 'year')) {
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
