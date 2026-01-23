import dayjs from 'dayjs'

export const isToday = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs(), 'day')
}

export const isTomorrow = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs().add(1, 'day'), 'day')
}

export const isYesterday = (m: dayjs.Dayjs) => {
    return m.isSame(dayjs().subtract(1, 'day'), 'day')
}

export const isIn7DaysFromNow = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().subtract(7, 'days')) && m.isBefore(dayjs().add(1, 'day'))
}

export const isIn30DaysFromNow = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().subtract(30, 'days')) && m.isBefore(dayjs().add(1, 'day'))
}

export const isAfterThisYear = (m: dayjs.Dayjs) => {
    return m.isAfter(dayjs().endOf('year'))
}

export const isExpired = (date: dayjs.Dayjs | string | null) => {
    if (typeof date === 'string') date = dayjs(date)
    if (!date) return false
    return date.isBefore(dayjs())
}

export const formatForDateTimeInput = (m: dayjs.Dayjs) => {
    return m.format('YYYY-MM-DDTHH:mm')
}
