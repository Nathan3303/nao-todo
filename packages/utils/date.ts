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

export const useMoment = (payload?: moment.MomentInput) => {
    return moment(payload).utcOffset(8, true).locale('zh-CN')
}

export const isToday = (m: Moment) => {
    return m.isSame(useMoment(), 'day')
}

export const isTomorrow = (m: Moment) => {
    return m.isSame(useMoment().add(1, 'day'), 'day')
}

export const isYesterday = (m: Moment) => {
    return m.isSame(useMoment().subtract(1, 'day'), 'day')
}

export const isIn7DaysFromNow = (m: Moment) => {
    return m.isBetween(useMoment().subtract(7, 'days'), moment().add(1, 'day'))
}

export const isIn30DaysFromNow = (m: Moment) => {
    return m.isBetween(useMoment().subtract(30, 'days'), moment().add(1, 'day'))
}

export const isAfterThisYear = (m: Moment) => {
    return m.isAfter(useMoment().endOf('year'))
}

export const isExpired = (date: Moment | string | null) => {
    if (typeof date === 'string') date = useMoment(date)
    if (!date) return false
    return date.isBefore(useMoment())
}

export const formatForDateTimeInput = (m: Moment) => {
    return m.format('YYYY-MM-DDTHH:mm')
}
