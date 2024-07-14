import type { Todo } from '@/stores/use-todo-store'
import moment from 'moment'

export type DateInfo = { startAt: string; endAt: string }

export type UseDateInfoCallback = (dueDate: Todo['dueDate']) => void

export function useDateInfo() {
    const dateInfo: DateInfo = { startAt: '', endAt: '' }

    const parseDate = (date: string | number) => {
        const _date = date === 0 ? moment() : moment(date)
        const isoString = _date.toISOString(true)
        const sliced = isoString.slice(0, 16)
        // console.log(sliced)
        return sliced
    }

    function convert(dueDate?: Todo['dueDate']) {
        // console.log(dueDate)
        if (!dueDate) {
            return dateInfo as DateInfo
        }
        dateInfo.startAt = dueDate.startAt ? parseDate(dueDate.startAt) : ''
        dateInfo.endAt = dueDate.endAt ? parseDate(dueDate.endAt) : ''
        return dateInfo as DateInfo
    }

    const reConvert = (dateInfo: DateInfo) => {
        const { startAt, endAt } = dateInfo
        const dueDate = {
            startAt: startAt === '' ? null : moment(startAt).toISOString(true),
            endAt: endAt === '' ? null : moment(endAt).toISOString(true)
        }
        // console.log(dueDate)
        return dueDate
    }

    const checkDate = (dateInfo: DateInfo) => {
        const { startAt, endAt } = dateInfo
        const isValid = endAt !== '' && moment(startAt).isBefore(endAt)
        return isValid
    }

    return { parseDate, convert, reConvert, checkDate }
}
