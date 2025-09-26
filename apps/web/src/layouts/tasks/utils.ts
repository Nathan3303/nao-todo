import type { Project, Tag, GetTodosOptions, TodoColumnOptions } from '@nao-todo/types'
import type { TasksMainViewProps } from './types'
import { defaultColumnOptions } from '@/layouts'

type ProjectPreferenceRaw = {
    viewType: string
    getTodosOptions: unknown
    columns: unknown
}

const parsePreference = (
    preferenceRaw: ProjectPreferenceRaw
): Project['preference'] | Tag['preference'] => {
    const { viewType, getTodosOptions, columns } = preferenceRaw
    let iGetTodosOptions: GetTodosOptions = getTodosOptions ?? {}
    let iColumns: TodoColumnOptions = columns ?? { ...defaultColumnOptions }

    if (typeof getTodosOptions === 'string') {
        try {
            iGetTodosOptions = JSON.parse(getTodosOptions)
        } catch (error) {
            console.warn('parse project preference error:', error)
        }
    }

    if (typeof columns === 'string') {
        try {
            iColumns = JSON.parse(columns)
        } catch (error) {
            console.warn('parse project preference error:', error)
        }
    }

    return { viewType, getTodosOptions: iGetTodosOptions, columns: iColumns }
}

const toProjectViewProps = (project: Project): TasksMainViewProps => {
    const result: Partial<TasksMainViewProps> = {}
    result.id = project.id
    result.category = 'project'
    result.icon = ''
    result.name = project.name
    result.description = project.description
    result.preference = parsePreference(project.preference)
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
    result.preference = parsePreference(tag.preference)
    result.createTodoOptions = {
        tags: [tag.id]
    }
    return result as TasksMainViewProps
}

export { toProjectViewProps, toTagViewProps }
