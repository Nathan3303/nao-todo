type FilterOptions = {
    name: string
    state: string
    priority: string
}

type TodoFilterBarProps = {
    filterOptions: FilterOptions
    simple?: boolean
}

type TodoFilterBarEmits = {
    (event: 'filter', payload: FilterOptions): void
}

type FrameworkOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

type FrameworkOptions<T> = FrameworkOption<T>[]

export type {
    TodoFilterBarProps,
    TodoFilterBarEmits,
    FilterOptions as TodoFilterOptions,
    FrameworkOptions
}
