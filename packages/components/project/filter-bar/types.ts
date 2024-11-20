type FilterOptions = {
    title?: string
    isDeleted?: boolean
    isArchived?: boolean
}

type ProjectFilterBarProps = {
    filterOptions: FilterOptions
}

type ProjectFilterBarEmits = {
    (event: 'filter', payload: FilterOptions | null): void
}

type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type { ProjectFilterBarProps, ProjectFilterBarEmits, FilterOption }
