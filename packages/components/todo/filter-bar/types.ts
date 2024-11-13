import type { GetTodosOptions, GetTodosOverview } from '@nao-todo/types'

export type TodoFilterBarProps = {
    filterInfo: GetTodosOptions
    countInfo: GetTodosOverview['countInfo']
}

export type TodoFilterBarEmits = {
    (event: 'filter', payload: GetTodosOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
