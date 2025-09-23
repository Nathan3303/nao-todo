import type { Project, Tag } from '@nao-todo/types'
import type { TasksMainViewProps } from './types'
import { defaultColumnOptions } from '@/layouts'

const toProjectViewProps = (project: Project): TasksMainViewProps => {
    const result: Partial<TasksMainViewProps> = {}
    result.id = project.id
    result.category = 'project'
    result.icon = ''
    result.name = project.name
    result.description = project.description
    // const pGetTodosOptions = JSON.parse(project.preference.getTodosOptions)
    result.preference = {
        viewType: project.preference.viewType,
        getTodosOptions: {},
        columns: { ...defaultColumnOptions }
    }
    result.createTodoOptions = {
        dueDate: {},
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
    // const tGetTodosOptions = JSON.parse(tag.preference.getTodosOptions)
    result.preference = {
        viewType: 'table',
        getTodosOptions: {},
        columns: { ...defaultColumnOptions }
    }
    result.createTodoOptions = {
        dueDate: {},
        tags: [tag.id]
    }
    return result as TasksMainViewProps
}

export { toProjectViewProps, toTagViewProps }
