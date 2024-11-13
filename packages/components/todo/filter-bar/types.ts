type TodoFilterOptions = {
    name?: string
    state?: string
    priority?: string
}

export type TodoFilterBarProps = {
    filterOptions: TodoFilterOptions
}

export type TodoFilterBarEmits = {
    (event: 'filter', payload: TodoFilterOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
