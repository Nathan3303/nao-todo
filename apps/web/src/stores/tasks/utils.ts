import { defaultColumnOptions } from '@/stores/tasks/constants'
import type { Project, Tag } from '@nao-todo/types'

type ProjectPreferenceRaw = {
    viewType: string
    getTodosOptions: unknown
    columns: unknown
}

const toObject = (source: unknown, def?: object): object => {
    if (typeof source === 'string') {
        try {
            return JSON.parse(source)
        } catch (error) {
            console.warn('[ToObject] Error:', error)
            return def ?? {}
        }
    } else if (typeof source === 'object') {
        return source ?? def ?? {}
    } else {
        return def ?? {}
    }
}

const parsePreference = (
    preferenceRaw: ProjectPreferenceRaw
): Project['preference'] | Tag['preference'] => {
    const { viewType, getTodosOptions, columns } = preferenceRaw
    const iGetTodosOptions = toObject(getTodosOptions, {})
    const iColumns = toObject(columns, { ...defaultColumnOptions })
    // console.log(iGetTodosOptions, iColumns)
    return { viewType, getTodosOptions: iGetTodosOptions, columns: iColumns }
}

export { toObject, parsePreference }
