import type { TagFilterOptions } from '@nao-todo/stores'

export type TagFilterBarProps = {
    filterInfo: TagFilterOptions
}

export type TagFilterBarEmits = {
    (event: 'filter', payload: TagFilterOptions): void
}

export type FilterOption<T> = {
    label: string
    value: T
    checked: boolean
    icon?: string
    suffix?: number
}

export type FilterOptions<T> = Array<FilterOption<T>>
