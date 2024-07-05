import type { Todo } from '@/stores/use-todo-store'
import moment from 'moment'

export type DateInfo = { startAt: string; endAt: string }

export type UseDateInfoCallback = (dueDate: Todo['dueDate']) => void

export function useDateInfo() {
    const dateInfo: DateInfo = { startAt: '', endAt: '' }

    const parseDate = (date: string | number) => {
        const _date = date === 0 ? moment() : moment(date)
        const isoString = _date.utcOffset('+08:00').toISOString()
        const sliced = isoString.slice(0, 16)
        // console.log(sliced)
        return sliced
    }

    function convert(dueDate?: Todo['dueDate']) {
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
            startAt: startAt === '' ? null : moment(startAt).toISOString(),
            endAt: endAt === '' ? null : moment(endAt).toISOString()
        }
        // console.log(dueDate)
        return dueDate
    }

    return { parseDate, convert, reConvert }
}
