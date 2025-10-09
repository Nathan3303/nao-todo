import { defaultColumnOptions } from '@/layouts'
import type { Project, Tag } from '@nao-todo/types'
import type { TasksMainViewProps } from './types'

type ProjectPreferenceRaw = {
    viewType: string
    getTodosOptions: unknown
    columns: unknown
}

const _toObject = (source: unknown, def?: object): object => {
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

const _parsePreference = (
    preferenceRaw: ProjectPreferenceRaw
): Project['preference'] | Tag['preference'] => {
    const { viewType, getTodosOptions, columns } = preferenceRaw
    const iGetTodosOptions = _toObject(getTodosOptions, {})
    const iColumns = _toObject(columns, { ...defaultColumnOptions })
    // console.log(iGetTodosOptions, iColumns)
    return { viewType, getTodosOptions: iGetTodosOptions, columns: iColumns }
}

const toProjectViewProps = (project: Project): TasksMainViewProps => {
    const result: Partial<TasksMainViewProps> = {}
    result.id = project.id
    result.category = 'project'
    result.icon = ''
    result.name = project.name
    result.description = project.description
    result.preference = _parsePreference(project.preference)
    result.createTodoOptions = {
        projectId: project.id
    }
    return result as TasksMainViewProps
}

const toTagViewProps = (tag: Tag): TasksMainViewProps => {
    const result: Partial<TasksMainViewProps> = {}
    result.id = tag.id
    result.category = 'tag'
    result.icon = ''
    result.name = tag.name
    result.description = tag.description
    result.preference = _parsePreference(tag.preference)
    result.createTodoOptions = {
        tags: [tag.id]
    }
    return result as TasksMainViewProps
}

export { toProjectViewProps, toTagViewProps }
