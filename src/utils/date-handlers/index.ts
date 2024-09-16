import moment from 'moment'
import type { Moment } from 'moment'

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

export const isAfterThisYear = (date: Moment) => {
    return date.isAfter(moment().endOf('year'))
}

export const isExpired = (date: Moment | string | null) => {
    if (date === null) return false
    if (typeof date === 'string') date = moment(date)
    return date.isBefore(moment())
}
