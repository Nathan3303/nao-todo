export type FilterOptions = {
    title?: string
    isDeleted?: boolean
    isArchived?: boolean
}

export type ProjectFilterBarProps = {
    filterOptions: FilterOptions
}

export type ProjectFilterBarEmits = {
    (event: 'filter', payload: FilterOptions | null): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

// export type FilterOptions<T> = Array<FilterOption<T>>
