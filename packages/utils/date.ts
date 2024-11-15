import moment from 'moment'
import type { Moment } from 'moment'

moment.updateLocale('zh-CN', {
    months: '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
    weekdays: '周日_周一_周二_周三_周四_周五_周六'.split('_'),
    weekdaysShort: ['日', '一', '二', '三', '四', '五', '六'],
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

export const useMoment = () => {
    return moment().locale('zh-CN')
}

export const isToday = (date: Moment) => {
    return date.isSame(moment(), 'day')
}

export const isTomorrow = (date: Moment) => {
    return date.isSame(moment().add(1, 'day'), 'day')
}

export const isYesterday = (date: Moment) => {
    return date.isSame(moment().subtract(1, 'day'), 'day')
}

export const isIn7DaysFromNow = (date: Moment) => {
    return date.isBetween(moment().subtract(7, 'days'), moment().add(1, 'day'))
}

export const isIn30DaysFromNow = (date: Moment) => {
    return date.isBetween(moment().subtract(30, 'days'), moment().add(1, 'day'))
}

export const isAfterThisYear = (date: Moment) => {
    return date.isAfter(moment().endOf('year'))
}

export const isExpired = (date: Moment | string | null) => {
    if (typeof date === 'string') date = moment(date)
    if (!date) return false
    return date.isBefore(moment())
}
