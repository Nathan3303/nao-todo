type FilterOptions = {
    name: string | null
}

type TagFilterBarProps = {
    filterOptions: FilterOptions
}

type TagFilterBarEmits = {
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

export type { TagFilterBarProps, TagFilterBarEmits, FrameworkOptions }
