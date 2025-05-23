import type { CreateTodoOptions, GetTodosOptions, Todo, TodoColumnOptions } from '@nao-todo/types'

type TasksMainRouteCategory = 'basic' | 'project' | 'tag' | 'unknown'

type TasksMainViewInfo = {
    id: string
    title: string
    description: string
    preference: {
        viewType: string
        getTodosOptions: GetTodosOptions
        columns: TodoColumnOptions
    }
    createTodoOptions: CreateTodoOptions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    handlers?: Record<string, Function>
    payload?: Record<string, unknown>
}

type TasksMainBasicViewNames =
    | 'all'
    | 'today'
    | 'tomorrow'
    | 'week'
    | 'inbox'
    | 'favorite'
    | 'giveup'
    | 'recycle'

type TasksMultiSelectInfo = {
    isShowMultiDetails: boolean
    selectedTodoIds: Todo['id'][]
}

export type {
    TasksMainRouteCategory,
    TasksMainViewInfo,
    TasksMainBasicViewNames,
    TasksMultiSelectInfo
}
