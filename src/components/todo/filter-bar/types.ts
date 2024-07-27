import type { TodoCountInfo, TodoFilter } from '@/stores'

export type TodoFilterBarProps = {
    filterInfo: TodoFilter
    countInfo: TodoCountInfo
}

export type TodoFilterBarEmits = {
    (event: 'filter', payload: TodoFilter): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
